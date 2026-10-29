-- Catálogo online como canal de venda (ONE-148, fase 1, 29/10/2026).
-- O catálogo é um site público fora da Pólia (feito pela Pólia Lab, e depois
-- montado pela própria dona no Premium). Quando a cliente confirma o pedido lá,
-- o Worker chama registrar_pedido_catalogo com o service role e o pedido entra
-- no quadro de Pedidos da dona, em "A fazer", antes de a cliente mandar o
-- WhatsApp (o mesmo desenho do Ordena PRO, Polia Lab/pesquisa/ORDENA-PRO-CATALOGO.md).
--
-- O que já existia e foi só reaproveitado:
-- * vendas + venda_itens (o pedido É uma venda com andamento e entrega_em, GRW-93);
-- * clientes (acha ou cria pelo WhatsApp, como a capturar_lead);
-- * canal_conexoes (a loja da dona; shop_id = domínio do catálogo, sem www, ex.:
--   lovelesscrochet.com.br). O Worker só aceita pedido vindo desse domínio (CORS).
-- Nada novo aparece no menu: só um cartão em Configurações > Integrações.
--
-- Proteção do endereço público (mesmo molde da capturar_lead): só conta com
-- plano pago, até 100 pedidos por dia por loja e 5 por hora por aparelho.
-- O preço vem do catálogo (fase 1 ainda não lê Produtos): o pedido entra como
-- "a receber" e a dona confirma com a cliente pelo WhatsApp.

-- ── 1. o canal novo ────────────────────────────────────────────────────────
alter table public.vendas drop constraint if exists vendas_canal_check;
alter table public.vendas add constraint vendas_canal_check check (canal in (
  'instagram', 'whatsapp', 'presencial', 'encomenda', 'site', 'shopee', 'tiktok_shop',
  'mercado_livre', 'catalogo', 'outro'
));

alter table public.canal_conexoes drop constraint if exists canal_conexoes_canal_check;
alter table public.canal_conexoes
  add constraint canal_conexoes_canal_check
  check (canal in ('tiktok_shop', 'shopee', 'mercado_livre', 'catalogo'));

-- Mesmos nomes de CANAL_LABEL em src/lib/vendas.ts (canalVendaNome.test.ts confere).
create or replace function public.canal_venda_nome(p_canal text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case p_canal
    when 'instagram' then 'Instagram'
    when 'whatsapp' then 'WhatsApp'
    when 'presencial' then 'Presencial ou feira'
    when 'encomenda' then 'Encomenda'
    when 'site' then 'Site'
    when 'shopee' then 'Shopee'
    when 'tiktok_shop' then 'TikTok Shop'
    when 'mercado_livre' then 'Mercado Livre'
    when 'catalogo' then 'Catálogo online'
    when 'outro' then 'Outro'
    else p_canal
  end;
$fn$;

revoke all on function public.canal_venda_nome(text) from public, anon, authenticated;

-- ── 2. envios (conta o limite por loja e por aparelho) ─────────────────────
create table if not exists public.catalogo_envios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venda_id uuid references public.vendas (id) on delete set null,
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 128),
  created_at timestamptz not null default now()
);
create index if not exists catalogo_envios_por_loja on public.catalogo_envios (user_id, created_at);
create index if not exists catalogo_envios_por_aparelho on public.catalogo_envios (ip_hash, created_at)
  where ip_hash is not null;
alter table public.catalogo_envios enable row level security;
revoke all on public.catalogo_envios from public, anon, authenticated;

-- ── 3. registrar_pedido_catalogo ───────────────────────────────────────────
-- Devolve 'ok' (pedido novo), 'repetido' (o mesmo pedido chegou de novo),
-- 'indisponivel' (domínio sem loja ligada ou conta sem plano pago) ou 'limite'.
-- p_itens: [{ "nome": text, "variacao": text|null, "quantidade": int, "preco_unitario": numeric }]
-- p_whatsapp: só dígitos, com 55 (o Worker normaliza).
create or replace function public.registrar_pedido_catalogo(
  p_dominio text,
  p_id_externo text,
  p_itens jsonb,
  p_cliente_nome text,
  p_whatsapp text,
  p_observacao text default null,
  p_prazo_dias_uteis integer default 7,
  p_ip_hash text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid;
  v_plano text;
  v_nome text := left(btrim(coalesce(p_cliente_nome, '')), 120);
  v_ip text := left(nullif(btrim(p_ip_hash), ''), 128);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_entrega date;
  v_dias integer := least(greatest(coalesce(p_prazo_dias_uteis, 7), 1), 60);
  v_cliente_id uuid;
  v_venda_id uuid;
  v_item jsonb;
  v_qtd integer;
  v_preco numeric;
  v_subtotal numeric := 0;
begin
  if v_nome = '' or p_whatsapp is null or p_whatsapp !~ '^[0-9]{12,13}$'
     or nullif(btrim(p_id_externo), '') is null or char_length(p_id_externo) > 200 then
    raise exception 'Pedido do catálogo inválido' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 50 then
    raise exception 'Pedido sem itens' using errcode = 'check_violation';
  end if;

  select c.user_id, p.plano into v_uid, v_plano
    from canal_conexoes c
    join profiles p on p.id = c.user_id
   where c.canal = 'catalogo' and c.shop_id = lower(btrim(p_dominio)) and c.status = 'conectada';
  -- Mesma lista de planos pagos da capturar_lead (tierDoPlano + beta em src/lib/planos.ts).
  if v_uid is null or coalesce(v_plano, '') not in ('controle', 'projete', 'beta') then
    return 'indisponivel';
  end if;

  -- Idempotente: a cliente que toca duas vezes em Confirmar não cria dois pedidos.
  if exists (select 1 from vendas where user_id = v_uid and canal = 'catalogo' and id_externo = p_id_externo) then
    return 'repetido';
  end if;

  if (select count(*) from catalogo_envios
       where user_id = v_uid and created_at > now() - interval '1 day') >= 100 then
    return 'limite';
  end if;
  if v_ip is not null and (select count(*) from catalogo_envios
       where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 5 then
    return 'limite';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    if v_qtd is null or v_qtd <= 0 or v_qtd > 1000 or v_preco is null or v_preco < 0 or v_preco > 100000
       or nullif(btrim(v_item ->> 'nome'), '') is null then
      raise exception 'Item com quantidade, preço ou nome inválido' using errcode = 'check_violation';
    end if;
    v_subtotal := v_subtotal + v_qtd * v_preco;
  end loop;

  -- Entrega combinada: hoje + prazo de produção da marca, contado em dias úteis.
  v_entrega := v_hoje;
  while v_dias > 0 loop
    v_entrega := v_entrega + 1;
    if extract(isodow from v_entrega) < 6 then
      v_dias := v_dias - 1;
    end if;
  end loop;

  -- Cliente pelo WhatsApp: acha a ficha que já existe ou cria uma nova, sem mexer
  -- no que a dona já escreveu nela.
  select id into v_cliente_id from clientes where user_id = v_uid and whatsapp = p_whatsapp;
  if v_cliente_id is null then
    insert into clientes (user_id, nome, whatsapp, origem, status_pedido)
    -- "Primeiro contato": o pedido ainda vai ser confirmado com a dona pelo WhatsApp.
    values (v_uid, v_nome, p_whatsapp, 'site', 'Primeiro contato')
    on conflict (user_id, whatsapp) where whatsapp is not null do nothing
    returning id into v_cliente_id;
    if v_cliente_id is null then
      select id into v_cliente_id from clientes where user_id = v_uid and whatsapp = p_whatsapp;
    end if;
  end if;

  v_venda_id := gen_random_uuid();
  begin
    insert into vendas (
      id, user_id, canal, id_externo, data, status, categoria, cliente_id, cliente_nome,
      subtotal, desconto, frete, taxa_canal, total, observacao, andamento, entrega_em
    ) values (
      v_venda_id, v_uid, 'catalogo', p_id_externo, v_hoje, 'a_receber', 'Venda de produto',
      v_cliente_id, v_nome, v_subtotal, 0, 0, 0, v_subtotal,
      left(nullif(btrim(p_observacao), ''), 500), 'a_fazer', v_entrega
    );
  exception when unique_violation then
    return 'repetido';
  end;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    insert into venda_itens (user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade, preco_unitario, custo_unitario)
    values (
      v_uid, v_venda_id, null, null,
      left(btrim(v_item ->> 'nome'), 200),
      left(nullif(btrim(v_item ->> 'variacao'), ''), 80),
      (v_item ->> 'quantidade')::integer,
      round((v_item ->> 'preco_unitario')::numeric, 2),
      null
    );
  end loop;

  insert into catalogo_envios (user_id, venda_id, ip_hash) values (v_uid, v_venda_id, v_ip);
  return 'ok';
end;
$fn$;

revoke all on function public.registrar_pedido_catalogo(text, text, jsonb, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido_catalogo(text, text, jsonb, text, text, text, integer, text)
  to service_role;
