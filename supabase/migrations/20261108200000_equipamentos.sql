-- ONE-193 (08/11/2026): equipamentos da marca. Nasceu no orçamento da Mundo de
-- Aimer: não havia onde listar máquina, e a compra lançada no Financeiro saía
-- inteira do lucro do mês e entrava nos custos fixos da Projeção.
--
-- Comprado é quem tem lancamento_id. Com on delete set null, excluir a saída
-- no Financeiro devolve o equipamento pra planejado sem nenhuma outra escrita.
--
-- Mesmo modelo dos insumos: a usuária só LÊ a tabela; toda escrita passa pelas
-- funções abaixo (SECURITY DEFINER, auth.uid() em cada leitura e escrita). A
-- saída usa a categoria "Compra de equipamento", a mesma constante
-- CATEGORIA_EQUIPAMENTO de src/lib/projecao.functions.ts.

create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  valor numeric(12, 2) not null check (valor > 0 and valor <= 1000000),
  meses_uso integer not null check (meses_uso between 1 and 240),
  lancamento_id uuid references public.lancamentos (id) on delete set null,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipamentos_user_idx on public.equipamentos (user_id, created_at);
create unique index if not exists equipamentos_lancamento_uniq
  on public.equipamentos (lancamento_id)
  where lancamento_id is not null;

drop trigger if exists equipamentos_updated on public.equipamentos;
create trigger equipamentos_updated before update on public.equipamentos
  for each row execute function public.vendas_tocar_updated_at();

alter table public.equipamentos enable row level security;
revoke all on public.equipamentos from anon, authenticated;
grant select on public.equipamentos to authenticated;

drop policy if exists "Equipamentos: dona lê" on public.equipamentos;
create policy "Equipamentos: dona lê" on public.equipamentos for select to authenticated
  using (user_id = auth.uid());

-- Mesma régua de temNumerosDoMes (src/lib/planos.ts) depois da virada de preços:
-- Premium, Pro e beta. Conta sem perfil ou no Grátis fica de fora.
create or replace function public.equipamentos_exigir_plano(p_uid uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where id = p_uid and plano in ('controle', 'projete', 'beta')
  ) then
    raise exception 'Recurso do Premium' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- p_id null cria; com id, edita. Equipamento já comprado leva o preço novo pra
-- saída do Financeiro, senão as duas telas passariam a discordar.
create or replace function public.salvar_equipamento(
  p_id uuid,
  p_nome text,
  p_valor numeric,
  p_meses integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text := btrim(coalesce(p_nome, ''));
  v_valor numeric := round(p_valor, 2);
  v_id uuid;
  v_lancamento uuid;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  perform equipamentos_exigir_plano(v_uid);
  if char_length(v_nome) not between 1 and 80 then
    raise exception 'Nome inválido' using errcode = 'check_violation';
  end if;
  if v_valor is null or v_valor <= 0 or v_valor > 1000000
     or p_meses is null or p_meses not between 1 and 240 then
    raise exception 'Valor inválido' using errcode = 'check_violation';
  end if;

  if p_id is null then
    insert into equipamentos (user_id, nome, valor, meses_uso)
    values (v_uid, v_nome, v_valor, p_meses)
    returning id into v_id;
    return v_id;
  end if;

  update equipamentos set nome = v_nome, valor = v_valor, meses_uso = p_meses
  where id = p_id and user_id = v_uid and not arquivado
  returning id, lancamento_id into v_id, v_lancamento;
  if v_id is null then
    raise exception 'Equipamento não encontrado' using errcode = 'no_data_found';
  end if;
  if v_lancamento is not null then
    update lancamentos
    set valor = v_valor, descricao = 'Compra de equipamento · ' || v_nome
    where id = v_lancamento and user_id = v_uid;
  end if;
  return v_id;
end;
$$;

-- Marca como comprado: cria a saída e guarda o preço pago, que pode ser
-- diferente do orçado. id_externo único impede saída dobrada em clique repetido.
create or replace function public.marcar_equipamento_comprado(
  p_id uuid,
  p_data date,
  p_valor numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_valor numeric := round(p_valor, 2);
  v_equip public.equipamentos;
  v_lancamento uuid;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  perform equipamentos_exigir_plano(v_uid);
  if v_valor is null or v_valor <= 0 or v_valor > 1000000 then
    raise exception 'Valor inválido' using errcode = 'check_violation';
  end if;
  if p_data is null or p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data inválida' using errcode = 'check_violation';
  end if;

  select * into v_equip from equipamentos
    where id = p_id and user_id = v_uid and not arquivado
    for update;
  if not found then
    raise exception 'Equipamento não encontrado' using errcode = 'no_data_found';
  end if;
  if v_equip.lancamento_id is not null then
    raise exception 'Equipamento já comprado' using errcode = 'unique_violation';
  end if;

  insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo)
  values (
    v_uid, 'saida', v_valor, p_data,
    'Compra de equipamento · ' || v_equip.nome,
    'Compra de equipamento',
    'equipamento:' || v_equip.id
  )
  returning id into v_lancamento;

  update equipamentos set valor = v_valor, lancamento_id = v_lancamento where id = p_id;
  return v_lancamento;
end;
$$;

-- Arquivar tira da lista e da reserva. A saída de quem já foi comprado continua
-- no Financeiro: o dinheiro saiu de verdade.
create or replace function public.arquivar_equipamento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  update equipamentos set arquivado = true
  where id = p_id and user_id = v_uid and not arquivado;
  if not found then
    raise exception 'Equipamento não encontrado' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.equipamentos_exigir_plano(uuid) from public, anon, authenticated;
revoke all on function public.salvar_equipamento(uuid, text, numeric, integer) from public, anon;
revoke all on function public.marcar_equipamento_comprado(uuid, date, numeric) from public, anon;
revoke all on function public.arquivar_equipamento(uuid) from public, anon;
grant execute on function public.salvar_equipamento(uuid, text, numeric, integer) to authenticated;
grant execute on function public.marcar_equipamento_comprado(uuid, date, numeric) to authenticated;
grant execute on function public.arquivar_equipamento(uuid) to authenticated;
