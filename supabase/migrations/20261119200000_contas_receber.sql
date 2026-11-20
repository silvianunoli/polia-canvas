-- ONE-207 Fase 2 (19/11/2026): contas a receber no Financeiro, no formato da
-- aba "Contas a receber" da planilha de conciliação da Sil (data, cliente,
-- documento, forma de recebimento, descrição, valor original, valor recebido).
--
-- Venda a receber continua morando em vendas (status 'a_receber', receber_venda):
-- a seção "A receber" do Financeiro lista as duas coisas juntas. Esta tabela é
-- pro que não nasceu de uma venda registrada: fiado, resto de encomenda
-- combinada por fora, parcela que a cliente paga por mês, reembolso.
--
-- Mesmo desenho de contas_pagar (20261023180000 + 20261119140000): a conta só
-- vira lançamento quando é recebida, e receber/desfazer passam por funções
-- SECURITY DEFINER pra conta e lançamento mudarem juntos.
--
--   valor           o original combinado.
--   valor_recebido  o que caiu de fato (crédito cai com a taxa da maquininha).
--   forma           chave de lib/taxas.ts (FORMAS_RECEBIMENTO), opcional.
--                   Voucher ficou de fora por decisão da Sil (19/11).
-- Sem repetição mensal: parcela resolve o caso da cliente que paga por mês.

create table if not exists public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  descricao text not null check (char_length(btrim(descricao)) between 1 and 120),
  cliente text check (cliente is null or char_length(cliente) between 1 and 80),
  documento text check (documento is null or char_length(documento) between 1 and 80),
  valor numeric(12, 2) not null check (valor > 0 and valor <= 99999999),
  vencimento date not null,
  categoria text check (categoria is null or char_length(categoria) <= 60),
  parcela smallint,
  parcelas smallint,
  status text not null default 'a_receber' check (status in ('a_receber', 'recebida')),
  recebido_em date,
  valor_recebido numeric(12, 2)
    check (valor_recebido is null or (valor_recebido > 0 and valor_recebido <= 99999999)),
  forma text check (forma is null or forma in (
    'pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link'
  )),
  lancamento_id uuid references public.lancamentos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'recebida') = (recebido_em is not null)),
  check ((status = 'recebida') = (valor_recebido is not null)),
  check (forma is null or status = 'recebida'),
  check (
    (parcela is null and parcelas is null)
    or (parcelas between 2 and 60 and parcela between 1 and parcelas)
  )
);

create index if not exists contas_receber_user_status_venc_idx
  on public.contas_receber (user_id, status, vencimento);

create or replace function public.contas_receber_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.descricao := btrim(new.descricao);
  new.cliente := nullif(btrim(new.cliente), '');
  new.documento := nullif(btrim(new.documento), '');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contas_receber_gravar on public.contas_receber;
create trigger contas_receber_gravar before insert or update on public.contas_receber
  for each row execute function public.contas_receber_antes_de_gravar();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.contas_receber enable row level security;

revoke all on public.contas_receber from anon, authenticated;
grant select, delete on public.contas_receber to authenticated;
-- status, recebido_em, valor_recebido, forma e lancamento_id: só as funções.
grant insert (user_id, descricao, cliente, documento, valor, vencimento, categoria, parcela, parcelas)
  on public.contas_receber to authenticated;
grant update (descricao, cliente, documento, valor, vencimento, categoria)
  on public.contas_receber to authenticated;

drop policy if exists "Receber: dona lê" on public.contas_receber;
create policy "Receber: dona lê" on public.contas_receber for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Receber: dona cria" on public.contas_receber;
create policy "Receber: dona cria" on public.contas_receber for insert to authenticated
  with check (user_id = auth.uid());
-- Conta recebida não se edita: o valor já virou entrada. Corrige desfazendo.
drop policy if exists "Receber: dona edita a receber" on public.contas_receber;
create policy "Receber: dona edita a receber" on public.contas_receber for update to authenticated
  using (user_id = auth.uid() and status = 'a_receber')
  with check (user_id = auth.uid() and status = 'a_receber');
drop policy if exists "Receber: dona exclui" on public.contas_receber;
create policy "Receber: dona exclui" on public.contas_receber for delete to authenticated
  using (user_id = auth.uid());

-- ── receber_conta ──────────────────────────────────────────────────────────
create or replace function public.receber_conta(
  p_conta_id uuid,
  p_data date,
  p_valor numeric default null,
  p_forma text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta public.contas_receber;
  v_valor numeric(12, 2);
  v_lancamento_id uuid;
begin
  select * into v_conta from contas_receber
    where id = p_conta_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Conta não encontrada' using errcode = 'no_data_found';
  end if;
  if v_conta.status <> 'a_receber' then
    raise exception 'Conta já recebida' using errcode = 'check_violation';
  end if;

  v_valor := round(coalesce(p_valor, v_conta.valor), 2);
  if v_valor <= 0 or v_valor > 99999999 then
    raise exception 'Valor recebido inválido' using errcode = 'check_violation';
  end if;

  insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
  values (
    v_conta.user_id, 'entrada', v_valor, coalesce(p_data, current_date),
    left(
      v_conta.descricao
        || case when v_conta.parcelas is not null
             then ' (' || v_conta.parcela || '/' || v_conta.parcelas || ')' else '' end
        || coalesce(' · ' || v_conta.cliente, ''),
      200
    ),
    v_conta.categoria, 'receber:' || p_conta_id
  ) returning id into v_lancamento_id;

  -- O check da coluna barra forma desconhecida (o gatilho não toca em forma).
  update contas_receber
    set status = 'recebida', recebido_em = coalesce(p_data, current_date),
        valor_recebido = v_valor, forma = nullif(btrim(p_forma), ''),
        lancamento_id = v_lancamento_id
    where id = p_conta_id;
  return v_lancamento_id;
end;
$$;

-- ── desfazer_recebimento ───────────────────────────────────────────────────
create or replace function public.desfazer_recebimento(p_conta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta public.contas_receber;
begin
  select * into v_conta from contas_receber
    where id = p_conta_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Conta não encontrada' using errcode = 'no_data_found';
  end if;
  if v_conta.status <> 'recebida' then
    return;
  end if;
  if v_conta.lancamento_id is not null then
    delete from lancamentos where id = v_conta.lancamento_id and user_id = v_conta.user_id;
  end if;
  update contas_receber
    set status = 'a_receber', recebido_em = null, valor_recebido = null,
        forma = null, lancamento_id = null
    where id = p_conta_id;
end;
$$;

revoke all on function public.receber_conta(uuid, date, numeric, text) from public, anon;
revoke all on function public.desfazer_recebimento(uuid) from public, anon;
grant execute on function public.receber_conta(uuid, date, numeric, text) to authenticated;
grant execute on function public.desfazer_recebimento(uuid) to authenticated;

-- A exclusão de conta de usuária (excluir_conta_usuario) apaga por user_id em
-- cascata via auth.users: on delete cascade acima cobre esta tabela.
