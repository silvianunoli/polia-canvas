-- Quadro de Pedidos, Fase 1 (GRW-93, plano docs/plano-quadro-de-pedidos.md,
-- aprovado pela Sil em 28/10/2026 com D1 a D7). O pedido É uma venda com duas
-- colunas a mais: o andamento no quadro (a coluna onde o cartão está) e o dia
-- combinado de entrega. Venda comum (andamento nulo) não aparece no quadro e não
-- muda em nada. "andamento", não "etapa": é o rótulo da tela, e "etapa" é
-- vocabulário proibido em texto visível (regras-de-marca.test.ts).
--
-- registrar_pedido grava a venda pela registrar_venda de sempre (itens, custo,
-- estoque, Financeiro) e marca andamento e entrega na mesma transação. No Grátis,
-- até 15 pedidos abertos (A fazer, Em produção, Pronto); a lista de Vendas
-- continua no Premium (D2). atualizar_pedido move o andamento e remarca a entrega.

alter table public.vendas
  add column if not exists andamento text,
  add column if not exists entrega_em date;

alter table public.vendas drop constraint if exists vendas_andamento_check;
alter table public.vendas add constraint vendas_andamento_check
  check (andamento is null or andamento in ('a_fazer', 'em_producao', 'pronto', 'entregue'));

-- Pedido sempre tem data de entrega; venda comum não tem nenhuma das duas.
alter table public.vendas drop constraint if exists vendas_pedido_com_entrega_check;
alter table public.vendas add constraint vendas_pedido_com_entrega_check
  check ((andamento is null) = (entrega_em is null));

create index if not exists vendas_pedidos_por_entrega
  on public.vendas (user_id, entrega_em)
  where andamento is not null;

create or replace function public.registrar_pedido(
  p_id uuid,
  p_entrega_em date,
  p_itens jsonb,
  p_cliente_id uuid default null,
  p_cliente_nome text default null,
  p_recebida boolean default false,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_plano text;
  v_abertos integer;
begin
  if v_uid is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    raise exception 'Pedido sem id' using errcode = 'check_violation';
  end if;
  -- Idempotente como a registrar_venda: repetir o envio devolve o mesmo pedido.
  if exists (select 1 from vendas where id = p_id and user_id = v_uid) then
    return p_id;
  end if;
  if p_entrega_em is null then
    raise exception 'Pedido sem data de entrega' using errcode = 'check_violation';
  end if;

  -- Trava a linha da dona: dois pedidos ao mesmo tempo não furam o teto.
  select plano into v_plano from profiles where id = v_uid for update;
  if coalesce(v_plano, 'confere') in ('confere', 'cancelada') then
    select count(*) into v_abertos
      from vendas
     where user_id = v_uid
       and andamento in ('a_fazer', 'em_producao', 'pronto')
       and status <> 'cancelada';
    if v_abertos >= 15 then
      raise exception 'Limite do plano Grátis atingido (15 pedidos abertos). Assine o Premium pra liberar.'
        using errcode = 'P0001';
    end if;
  end if;

  perform registrar_venda(
    p_id,
    (now() at time zone 'America/Sao_Paulo')::date,
    'encomenda',
    p_itens,
    p_cliente_id,
    p_cliente_nome,
    0, 0, 0,
    coalesce(p_recebida, false),
    p_observacao,
    false
  );

  update vendas
     set andamento = 'a_fazer', entrega_em = p_entrega_em
   where id = p_id and user_id = v_uid;

  return p_id;
end;
$fn$;

create or replace function public.atualizar_pedido(
  p_venda_id uuid,
  p_andamento text default null,
  p_entrega_em date default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if auth.uid() is null then
    raise exception 'Sem sessão' using errcode = 'insufficient_privilege';
  end if;
  if p_andamento is not null and p_andamento not in ('a_fazer', 'em_producao', 'pronto', 'entregue') then
    raise exception 'Andamento inválido' using errcode = 'check_violation';
  end if;
  update vendas
     set andamento = coalesce(p_andamento, andamento),
         entrega_em = coalesce(p_entrega_em, entrega_em)
   where id = p_venda_id
     and user_id = auth.uid()
     and andamento is not null
     and status <> 'cancelada';
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'no_data_found';
  end if;
end;
$fn$;

revoke all on function public.registrar_pedido(uuid, date, jsonb, uuid, text, boolean, text) from public, anon;
grant execute on function public.registrar_pedido(uuid, date, jsonb, uuid, text, boolean, text) to authenticated;
revoke all on function public.atualizar_pedido(uuid, text, date) from public, anon;
grant execute on function public.atualizar_pedido(uuid, text, date) to authenticated;
