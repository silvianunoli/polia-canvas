-- ONE-127 (23/10/2026): contas a pagar com vencimento e repetição mensal.
-- Benchmark Bling (ONE-126): o Financeiro só registrava o que já aconteceu;
-- aluguel, fornecedor e assinatura não tinham onde morar antes de pagar.
--
-- Tabela nova em vez de status em lancamentos: lançamento continua sendo
-- dinheiro que já entrou ou saiu (numerosDoMes, Painel, Projeção e resumo pro
-- contador somam tudo de lancamentos). A conta só vira lançamento quando é paga.
--
-- Escrita livre só nos campos da conta. Pagar e desfazer passam pelas funções
-- abaixo (SECURITY DEFINER, auth.uid() em cada leitura e escrita), porque
-- criam e apagam o lançamento e a próxima conta numa transação só. Sem isso dava
-- pra marcar "paga" sem lançamento, ou desfazer e pagar de novo duplicando a saída.

create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 120),
  valor numeric(12, 2) not null check (valor > 0 and valor <= 99999999),
  vencimento date not null,
  categoria text check (categoria is null or char_length(categoria) <= 60),
  recorrencia text not null default 'nenhuma' check (recorrencia in ('nenhuma', 'mensal')),
  -- Dia escolhido na primeira conta: a de 31/01 vence 28/02 e volta pra 31/03,
  -- em vez de ficar presa no 28 pra sempre.
  dia_recorrencia smallint check (dia_recorrencia between 1 and 31),
  status text not null default 'a_pagar' check (status in ('a_pagar', 'paga')),
  pago_em date,
  lancamento_id uuid references public.lancamentos (id) on delete set null,
  -- Conta do mês seguinte criada ao pagar esta; desfazer o pagamento apaga ela
  -- (se ainda estiver a pagar), pra repetição não duplicar.
  proxima_id uuid references public.contas_pagar (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paga') = (pago_em is not null))
);

create index if not exists contas_pagar_user_status_venc_idx
  on public.contas_pagar (user_id, status, vencimento);

create or replace function public.contas_pagar_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.vencimento is distinct from old.vencimento then
    new.dia_recorrencia := extract(day from new.vencimento)::smallint;
  end if;
  new.descricao := btrim(new.descricao);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contas_pagar_gravar on public.contas_pagar;
create trigger contas_pagar_gravar before insert or update on public.contas_pagar
  for each row execute function public.contas_pagar_antes_de_gravar();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.contas_pagar enable row level security;

revoke all on public.contas_pagar from anon, authenticated;
grant select, delete on public.contas_pagar to authenticated;
-- status, pago_em, lancamento_id e proxima_id ficam fora: só as funções mexem.
grant insert (user_id, descricao, valor, vencimento, categoria, recorrencia)
  on public.contas_pagar to authenticated;
grant update (descricao, valor, vencimento, categoria, recorrencia)
  on public.contas_pagar to authenticated;

drop policy if exists "Contas: dona lê" on public.contas_pagar;
create policy "Contas: dona lê" on public.contas_pagar for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Contas: dona cria" on public.contas_pagar;
create policy "Contas: dona cria" on public.contas_pagar for insert to authenticated
  with check (user_id = auth.uid());
-- Conta paga não se edita: o valor já virou lançamento. Corrige desfazendo.
drop policy if exists "Contas: dona edita a pagar" on public.contas_pagar;
create policy "Contas: dona edita a pagar" on public.contas_pagar for update to authenticated
  using (user_id = auth.uid() and status = 'a_pagar')
  with check (user_id = auth.uid() and status = 'a_pagar');
drop policy if exists "Contas: dona exclui" on public.contas_pagar;
create policy "Contas: dona exclui" on public.contas_pagar for delete to authenticated
  using (user_id = auth.uid());

-- ── próximo vencimento (mesma regra de proximoVencimento em lib/contasPagar.ts) ──
create or replace function public.contas_pagar_proximo_vencimento(p_vencimento date, p_dia smallint)
returns date
language sql
immutable
set search_path = public
as $$
  select make_date(
    extract(year from m)::int,
    extract(month from m)::int,
    least(
      coalesce(p_dia, extract(day from p_vencimento)::smallint)::int,
      extract(day from (m + interval '1 month - 1 day'))::int
    )
  )
  from (select (date_trunc('month', p_vencimento) + interval '1 month')::date as m) t;
$$;

-- ── pagar_conta ────────────────────────────────────────────────────────────
create or replace function public.pagar_conta(p_conta_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta public.contas_pagar;
  v_lancamento_id uuid;
  v_proxima_id uuid;
begin
  select * into v_conta from contas_pagar
    where id = p_conta_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Conta não encontrada' using errcode = 'no_data_found';
  end if;
  if v_conta.status <> 'a_pagar' then
    raise exception 'Conta já paga' using errcode = 'check_violation';
  end if;

  insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
  values (
    v_conta.user_id, 'saida', v_conta.valor, coalesce(p_data, current_date),
    v_conta.descricao, v_conta.categoria, 'conta:' || p_conta_id
  ) returning id into v_lancamento_id;

  if v_conta.recorrencia = 'mensal' then
    insert into contas_pagar (user_id, descricao, valor, vencimento, categoria, recorrencia)
    values (
      v_conta.user_id, v_conta.descricao, v_conta.valor,
      contas_pagar_proximo_vencimento(v_conta.vencimento, v_conta.dia_recorrencia),
      v_conta.categoria, 'mensal'
    ) returning id into v_proxima_id;
    -- O gatilho recalcula o dia pelo vencimento novo; devolve o dia original.
    update contas_pagar set dia_recorrencia = v_conta.dia_recorrencia where id = v_proxima_id;
  end if;

  update contas_pagar
    set status = 'paga', pago_em = coalesce(p_data, current_date),
        lancamento_id = v_lancamento_id, proxima_id = v_proxima_id
    where id = p_conta_id;
  return v_lancamento_id;
end;
$$;

-- ── desfazer_pagamento ─────────────────────────────────────────────────────
create or replace function public.desfazer_pagamento(p_conta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta public.contas_pagar;
begin
  select * into v_conta from contas_pagar
    where id = p_conta_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Conta não encontrada' using errcode = 'no_data_found';
  end if;
  if v_conta.status <> 'paga' then
    return;
  end if;
  -- Com a do mês seguinte já paga, desfazer esta e pagar de novo criaria um
  -- segundo vencimento no mesmo mês (revisão de 23/10). Desfaz na ordem.
  if exists (
    select 1 from contas_pagar
    where id = v_conta.proxima_id and user_id = v_conta.user_id and status = 'paga'
  ) then
    raise exception 'Mês seguinte já pago' using errcode = 'check_violation';
  end if;

  if v_conta.lancamento_id is not null then
    delete from lancamentos where id = v_conta.lancamento_id and user_id = v_conta.user_id;
  end if;
  if v_conta.proxima_id is not null then
    delete from contas_pagar
      where id = v_conta.proxima_id and user_id = v_conta.user_id and status = 'a_pagar';
  end if;

  update contas_pagar
    set status = 'a_pagar', pago_em = null, lancamento_id = null, proxima_id = null
    where id = p_conta_id;
end;
$$;

revoke all on function public.pagar_conta(uuid, date) from public, anon;
revoke all on function public.desfazer_pagamento(uuid) from public, anon;
grant execute on function public.pagar_conta(uuid, date) to authenticated;
grant execute on function public.desfazer_pagamento(uuid) to authenticated;
