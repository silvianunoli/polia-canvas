-- Checkout Transparente pela API de Orders do Mercado Pago (ONE-182, decisão da Sil em 07/11/2026).
-- A compradora paga dentro do site da loja: cartão pelo formulário do Mercado Pago e Pix
-- com QR na própria página. Cada tentativa cria uma order no Mercado Pago; a última fica
-- guardada aqui, para a página da compra mostrar o Pix e conferir o pagamento.
-- Reserva, confirmação, lançamento e estorno continuam nas funções de 20261106160000.

alter table public.loja_checkouts
  add column mp_order_id text,
  add column mp_meio text check (mp_meio in ('cartao', 'pix')),
  add column tentativas integer not null default 0 check (tentativas >= 0);

-- ── nova tentativa de pagar ───────────────────────────────────────────────
-- Devolve o que a cobrança precisa, lido do banco e nunca do navegador, e o número da
-- tentativa, que entra na chave de idempotência do Mercado Pago. No máximo 10 por compra:
-- cartão testado em série numa loja é golpe conhecido.
-- Resultado: ok | pago | fechado | limite | nao_encontrado.
create or replace function public.loja_checkout_tentar(p_dominio text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.loja_checkouts;
begin
  select * into v from loja_checkouts where id = p_id and dominio = lower(btrim(p_dominio)) for update;
  if not found then
    return jsonb_build_object('resultado', 'nao_encontrado');
  end if;
  if v.status = 'pago' then
    return jsonb_build_object('resultado', 'pago');
  end if;
  if v.status <> 'aberto' or v.expira_em < now() then
    return jsonb_build_object('resultado', 'fechado');
  end if;
  if v.tentativas >= 10 then
    return jsonb_build_object('resultado', 'limite');
  end if;
  update loja_checkouts set tentativas = tentativas + 1, updated_at = now() where id = v.id;
  return jsonb_build_object(
    'resultado', 'ok',
    'tentativa', v.tentativas + 1,
    'total', v.total,
    'nome', v.nome,
    'email', v.email,
    'mp_order_id', v.mp_order_id,
    'mp_meio', v.mp_meio
  );
end;
$$;

-- ── guardar a order criada ────────────────────────────────────────────────
create or replace function public.loja_checkout_cobranca(p_dominio text, p_id uuid, p_order_id text, p_meio text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update loja_checkouts
     set mp_order_id = left(p_order_id, 64), mp_meio = p_meio, updated_at = now()
   where id = p_id and dominio = lower(btrim(p_dominio)) and status = 'aberto' and p_meio in ('cartao', 'pix');
$$;

-- ── o que a página da compra mostra ───────────────────────────────────────
-- Igual à de 20261106160000, mais a order e o prazo. O Worker usa a order para conferir o
-- pagamento e montar o Pix, e não repassa o número dela ao navegador.
create or replace function public.loja_checkout_situacao(p_dominio text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', c.status,
    'nome', c.nome,
    'itens', c.itens,
    'total', c.total,
    'entrega_em', (select v.entrega_em from vendas v where v.id = c.venda_id),
    'expira_em', c.expira_em,
    'mp_order_id', c.mp_order_id,
    'mp_meio', c.mp_meio
  )
  from loja_checkouts c
  where c.id = p_id and c.dominio = lower(btrim(p_dominio));
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'loja_checkout_tentar(text, uuid)',
    'loja_checkout_cobranca(text, uuid, text, text)',
    'loja_checkout_situacao(text, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
