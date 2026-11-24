-- Pagamento no pedido (23/11/2026, pedido da Sil, desenho aprovado):
-- 1. registrar_pedido aceita onde vendeu (canal), forma e taxa. Marketplace
--    fica sem forma (quem paga é o marketplace); a taxa é a dele.
-- 2. definir_pagamento_pedido: troca forma e taxa depois, nos pedidos
--    anotados à mão e da Vitrine. Loja da marca e marketplaces chegam prontos.
-- 3. receber_venda leva a forma pro lançamento (antes saía sem).
-- 4. loja_checkout_confirmar grava a forma que o Mercado Pago informa
--    ("Pix", "Cartão em 2x") na venda e no lançamento; os pedidos antigos da
--    loja ganham a forma pelo texto que já estava na observação.
-- 5. canal_venda_nome: "Site" vira "Loja da marca", "Catálogo online" vira
--    "Vitrine online" (só nos lançamentos novos).

-- ── forma a partir do que o Mercado Pago informou ─────────────────────────
create or replace function public.forma_do_meio_mp(p_meio text, p_mp_meio text default null)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_meio, '') ~* 'pix' or p_mp_meio = 'pix' then 'pix'
    when coalesce(p_meio, '') ~* 'em\s*([2-9]|[1-9][0-9])\s*x' then 'credito_parcelado'
    when coalesce(p_meio, '') ~* 'cart' or p_mp_meio = 'cartao' then 'credito'
  end;
$$;
revoke all on function public.forma_do_meio_mp(text, text) from public, anon;
grant execute on function public.forma_do_meio_mp(text, text) to authenticated, service_role;

-- ── 1. registrar_pedido com canal, forma e taxa ───────────────────────────
drop function if exists public.registrar_pedido(uuid, date, jsonb, uuid, text, boolean, text);
create function public.registrar_pedido(
  p_id uuid,
  p_entrega_em date,
  p_itens jsonb,
  p_cliente_id uuid default null,
  p_cliente_nome text default null,
  p_recebida boolean default false,
  p_observacao text default null,
  p_canal text default 'encomenda',
  p_forma text default null,
  p_taxa_canal numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_plano text;
  v_abertos integer;
  v_canal text := coalesce(nullif(btrim(p_canal), ''), 'encomenda');
  v_forma text := nullif(btrim(p_forma), '');
  v_lancamento_id uuid;
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
  if v_canal not in ('instagram', 'whatsapp', 'presencial', 'encomenda', 'site', 'shopee',
                     'tiktok_shop', 'mercado_livre', 'catalogo', 'outro') then
    raise exception 'Canal inválido' using errcode = 'check_violation';
  end if;
  -- Marketplace paga a dona pelo próprio marketplace: a forma da compradora não vale aqui.
  if v_canal in ('shopee', 'tiktok_shop', 'mercado_livre') then
    v_forma := null;
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

  -- A registrar_venda só aceita os canais da venda à mão (marketplace e Vitrine
  -- entram pelas integrações). O pedido anotado nasce como encomenda e troca
  -- de canal logo abaixo, na mesma transação.
  perform registrar_venda(
    p_id,
    (now() at time zone 'America/Sao_Paulo')::date,
    case when v_canal in ('instagram', 'whatsapp', 'presencial', 'encomenda', 'site', 'outro')
         then v_canal else 'encomenda' end,
    p_itens,
    p_cliente_id,
    p_cliente_nome,
    0, 0, greatest(round(coalesce(p_taxa_canal, 0), 2), 0),
    coalesce(p_recebida, false),
    p_observacao,
    false
  );

  update vendas
     set andamento = 'a_fazer', entrega_em = p_entrega_em, forma = v_forma, canal = v_canal
   where id = p_id and user_id = v_uid
  returning lancamento_id into v_lancamento_id;
  if v_lancamento_id is not null then
    update lancamentos
       set forma = v_forma,
           descricao = left(concat_ws(' · ', 'Venda', canal_venda_nome(v_canal), nullif(btrim(p_cliente_nome), '')), 200)
     where id = v_lancamento_id and user_id = v_uid;
  end if;

  return p_id;
end;
$$;
revoke all on function public.registrar_pedido(uuid, date, jsonb, uuid, text, boolean, text, text, text, numeric) from public, anon;
grant execute on function public.registrar_pedido(uuid, date, jsonb, uuid, text, boolean, text, text, text, numeric) to authenticated, service_role;

-- ── 2. trocar forma e taxa depois ─────────────────────────────────────────
create or replace function public.definir_pagamento_pedido(p_venda_id uuid, p_forma text, p_taxa numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_venda public.vendas;
  v_forma text := nullif(btrim(p_forma), '');
  v_taxa numeric := round(coalesce(p_taxa, 0), 2);
  v_valor numeric;
begin
  select * into v_venda from vendas
    where id = p_venda_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'no_data_found';
  end if;
  if v_venda.canal in ('site', 'shopee', 'tiktok_shop', 'mercado_livre') then
    raise exception 'O pagamento deste pedido vem do canal e não muda aqui' using errcode = 'check_violation';
  end if;
  if v_taxa < 0 then
    raise exception 'A taxa não pode ser negativa' using errcode = 'check_violation';
  end if;
  v_valor := v_venda.total - v_taxa - coalesce(v_venda.custo_envio, 0);
  if v_valor <= 0 and v_venda.total > 0 then
    raise exception 'A taxa não pode ser maior que o total do pedido' using errcode = 'check_violation';
  end if;

  update vendas set forma = v_forma, taxa_canal = v_taxa, updated_at = now() where id = p_venda_id;
  if v_venda.lancamento_id is not null then
    update lancamentos set forma = v_forma, valor = v_valor
     where id = v_venda.lancamento_id and user_id = v_venda.user_id;
  end if;
end;
$$;
revoke all on function public.definir_pagamento_pedido(uuid, text, numeric) from public, anon;
grant execute on function public.definir_pagamento_pedido(uuid, text, numeric) to authenticated, service_role;

-- ── 3. receber leva a forma ───────────────────────────────────────────────
create or replace function public.receber_venda(p_venda_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_venda public.vendas;
  v_lancamento_id uuid;
  v_valor numeric;
begin
  select * into v_venda from vendas
    where id = p_venda_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Venda não encontrada' using errcode = 'no_data_found';
  end if;
  if v_venda.status <> 'a_receber' then
    raise exception 'Venda não está a receber' using errcode = 'check_violation';
  end if;

  v_valor := v_venda.total - v_venda.taxa_canal - coalesce(v_venda.custo_envio, 0);
  if v_valor > 0 then
    insert into lancamentos (user_id, tipo, valor, data, descricao, categoria, id_externo, forma)
    values (
      v_venda.user_id, 'entrada', v_valor, coalesce(p_data, v_venda.data),
      left(concat_ws(' · ', 'Venda', canal_venda_nome(v_venda.canal), v_venda.cliente_nome), 200),
      v_venda.categoria, 'venda:' || p_venda_id, v_venda.forma
    ) returning id into v_lancamento_id;
  end if;

  update vendas set status = 'recebida', lancamento_id = v_lancamento_id where id = p_venda_id;
  return v_lancamento_id;
end;
$$;

-- ── 5. nomes dos canais ───────────────────────────────────────────────────
create or replace function public.canal_venda_nome(p_canal text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_canal
    when 'instagram' then 'Instagram'
    when 'whatsapp' then 'WhatsApp'
    when 'presencial' then 'Presencial ou feira'
    when 'encomenda' then 'Encomenda'
    when 'site' then 'Loja da marca'
    when 'shopee' then 'Shopee'
    when 'tiktok_shop' then 'TikTok Shop'
    when 'mercado_livre' then 'Mercado Livre'
    when 'catalogo' then 'Vitrine online'
    when 'outro' then 'Outro'
    else p_canal
  end;
$$;

-- ── 4b. pedidos antigos da loja da marca ganham a forma ───────────────────
update public.vendas v
   set forma = public.forma_do_meio_mp(substring(v.observacao from 'Pix|Cartão em \d+x|Cartão'), c.mp_meio)
  from public.loja_checkouts c
 where c.venda_id = v.id and v.canal = 'site' and v.forma is null;
update public.lancamentos l
   set forma = v.forma
  from public.vendas v
 where l.id = v.lancamento_id and v.canal = 'site' and l.forma is null and v.forma is not null;