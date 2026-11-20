-- ONE-207 Fase 3 (20/11/2026): forma de recebimento gravada, pro fechamento do
-- mês por forma (a conciliação da planilha da Sil: quanto entrou em Pix,
-- crédito, débito, dinheiro...). Voucher fica de fora (decisão da Sil, 19/11).
--
--   lancamentos.forma  forma da entrada. A tela de lançamento grava direto
--                      (a tabela tem grant de tabela inteira pra dona).
--   vendas.forma       o modal de venda já perguntava a forma pra puxar a taxa
--                      (ONE-128), mas não guardava. Grava por definir_forma_venda,
--                      chamada logo depois do registrar_venda: assim nenhuma
--                      das RPCs grandes de venda (registrar, converter orçamento,
--                      marketplaces) muda de assinatura.
--   Gatilho em lancamentos: entrada que nasce de uma venda ("venda:<id>")
--                      herda a forma da venda. Cobre o receber_venda de depois.
--   receber_conta      passa a gravar a forma também no lançamento.
-- Tudo aditivo: coluna nula = forma não informada.

alter table public.lancamentos
  add column if not exists forma text;
alter table public.lancamentos drop constraint if exists lancamentos_forma_valida;
alter table public.lancamentos add constraint lancamentos_forma_valida
  check (forma is null or forma in ('pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link'));

alter table public.vendas
  add column if not exists forma text;
alter table public.vendas drop constraint if exists vendas_forma_valida;
alter table public.vendas add constraint vendas_forma_valida
  check (forma is null or forma in ('pix', 'dinheiro', 'debito', 'credito', 'credito_parcelado', 'link'));

-- ── herda a forma da venda ─────────────────────────────────────────────────
create or replace function public.lancamentos_forma_da_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.forma is null
     and new.id_externo ~ '^venda:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select v.forma into new.forma
      from vendas v
      where v.id = substring(new.id_externo from 7)::uuid and v.user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists lancamentos_forma_da_venda on public.lancamentos;
create trigger lancamentos_forma_da_venda before insert on public.lancamentos
  for each row execute function public.lancamentos_forma_da_venda();

-- ── definir_forma_venda ────────────────────────────────────────────────────
-- Grava a forma na venda e, se ela já virou entrada, no lançamento dela.
-- p_forma vazio/nulo limpa.
create or replace function public.definir_forma_venda(p_venda_id uuid, p_forma text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas;
  v_forma text := nullif(btrim(p_forma), '');
begin
  select * into v_venda from vendas
    where id = p_venda_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'no_data_found';
  end if;
  update vendas set forma = v_forma where id = p_venda_id;
  if v_venda.lancamento_id is not null then
    update lancamentos set forma = v_forma
      where id = v_venda.lancamento_id and user_id = v_venda.user_id;
  end if;
end;
$$;

revoke all on function public.definir_forma_venda(uuid, text) from public, anon;
grant execute on function public.definir_forma_venda(uuid, text) to authenticated;

-- ── receber_conta grava a forma no lançamento ──────────────────────────────
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
  v_forma text := nullif(btrim(p_forma), '');
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

  insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo, forma)
  values (
    v_conta.user_id, 'entrada', v_valor, coalesce(p_data, current_date),
    left(
      v_conta.descricao
        || case when v_conta.parcelas is not null
             then ' (' || v_conta.parcela || '/' || v_conta.parcelas || ')' else '' end
        || coalesce(' · ' || v_conta.cliente, ''),
      200
    ),
    v_conta.categoria, 'receber:' || p_conta_id, v_forma
  ) returning id into v_lancamento_id;

  update contas_receber
    set status = 'recebida', recebido_em = coalesce(p_data, current_date),
        valor_recebido = v_valor, forma = v_forma,
        lancamento_id = v_lancamento_id
    where id = p_conta_id;
  return v_lancamento_id;
end;
$$;

revoke all on function public.receber_conta(uuid, date, numeric, text) from public, anon;
grant execute on function public.receber_conta(uuid, date, numeric, text) to authenticated;
