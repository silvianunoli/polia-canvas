-- Fase 3a, etapa 3a.3 (VND-05): pedido pago no TikTok Shop vira venda na Pólia.
-- Plano: docs/plano-fase3a-tiktok-shop.md §2 e §5.
--
-- Caminho: webhook do TikTok → edge function tiktok-webhook (confere a
-- assinatura e grava em canal_eventos) → pg_cron a cada minuto chama a edge
-- function tiktok-sync → ela busca o pedido completo e chama
-- registrar_venda_canal / cancelar_venda_canal. A varredura de 15 minutos
-- (também no tiktok-sync) cobre webhook perdido.

-- ── fila de eventos ────────────────────────────────────────────────────────
-- Um pedido por linha: o mesmo pedido avisado de novo só volta para a fila.
create table if not exists public.canal_eventos (
  id bigint generated always as identity primary key,
  canal text not null check (canal in ('tiktok_shop', 'shopee')),
  shop_id text not null check (char_length(shop_id) <= 100),
  id_externo text not null check (char_length(id_externo) <= 100),
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  tentativas integer not null default 0,
  erro text check (erro is null or char_length(erro) <= 500),
  unique (canal, shop_id, id_externo)
);
create index if not exists canal_eventos_pendentes_idx
  on public.canal_eventos (recebido_em)
  where processado_em is null;

alter table public.canal_eventos enable row level security;
revoke all on public.canal_eventos from public, anon, authenticated;
grant all on public.canal_eventos to service_role;

-- ── venda vinda do canal (só servidor) ─────────────────────────────────────
-- Mesma regra da registrar_venda para item ligado (custo, baixa de estoque),
-- com três diferenças: a dona vem por parâmetro (quem chama é o servidor, sem
-- sessão), a venda é idempotente pelo pedido do canal (índice único da fase 1)
-- e item sem anúncio ligado entra sem produto e sem baixar estoque.
-- Pedido de marketplace entra "a receber": o canal repassa depois da entrega.
create or replace function public.registrar_venda_canal(
  p_user_id uuid,
  p_canal text,
  p_id_externo text,
  p_data date,
  p_itens jsonb,
  p_taxa_canal numeric default 0,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_sku public.produto_skus;
  v_produto public.produtos;
  v_qtd integer;
  v_preco numeric;
  v_subtotal numeric := 0;
  v_custo numeric := 0;
  v_custo_conhecido boolean := true;
  v_custo_item numeric;
  v_taxa numeric := round(coalesce(p_taxa_canal, 0), 2);
begin
  if p_user_id is null or p_canal not in ('tiktok_shop', 'shopee')
     or nullif(btrim(p_id_externo), '') is null or char_length(p_id_externo) > 200 then
    raise exception 'Venda do canal inválida' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 100 then
    raise exception 'Venda sem itens' using errcode = 'check_violation';
  end if;

  select id into v_id from vendas
    where user_id = p_user_id and canal = p_canal and id_externo = p_id_externo;
  if found then
    return v_id;
  end if;
  v_id := gen_random_uuid();

  -- Primeiro passe: valida e soma.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    if v_qtd is null or v_qtd <= 0 or v_qtd > 100000 or v_preco is null or v_preco < 0 then
      raise exception 'Item com quantidade ou preço inválido' using errcode = 'check_violation';
    end if;
    v_subtotal := v_subtotal + v_qtd * v_preco;
  end loop;
  if v_taxa < 0 then
    raise exception 'Valor negativo' using errcode = 'check_violation';
  end if;
  v_taxa := least(v_taxa, v_subtotal);

  begin
    insert into vendas (
      id, user_id, canal, id_externo, data, status, categoria,
      subtotal, desconto, frete, taxa_canal, total, observacao
    ) values (
      v_id, p_user_id, p_canal, p_id_externo, p_data, 'a_receber', 'Venda de produto',
      v_subtotal, 0, 0, v_taxa, v_subtotal, left(nullif(btrim(p_observacao), ''), 500)
    );
  exception when unique_violation then
    -- O mesmo pedido chegou duas vezes ao mesmo tempo: a outra chamada já registrou.
    select id into v_id from vendas
      where user_id = p_user_id and canal = p_canal and id_externo = p_id_externo;
    return v_id;
  end;

  -- Segundo passe: itens, custo e estoque.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item ->> 'quantidade')::integer;
    v_preco := round((v_item ->> 'preco_unitario')::numeric, 2);
    v_sku := null;
    v_produto := null;
    if v_item ->> 'sku_id' is not null then
      select * into v_sku from produto_skus
        where id = (v_item ->> 'sku_id')::uuid and user_id = p_user_id and not arquivado
        for update;
      if found then
        select * into v_produto from produtos
          where id = v_sku.produto_id and user_id = p_user_id and not arquivado
          for share;
      end if;
    end if;

    if v_produto.id is not null then
      v_custo_item := custo_do_item(v_produto, p_user_id);
      insert into venda_itens (
        user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade,
        preco_unitario, custo_unitario
      ) values (
        p_user_id, v_id, v_produto.id, v_sku.id, v_produto.nome, v_sku.variacao, v_qtd,
        v_preco, v_custo_item
      );
      if v_produto.controla_estoque then
        insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id)
        values (p_user_id, v_sku.id, 'venda', -v_qtd, v_id);
      end if;
    else
      -- Anúncio ainda sem produto da Pólia: a venda conta, o estoque não mexe.
      v_custo_item := null;
      insert into venda_itens (
        user_id, venda_id, produto_id, sku_id, produto_nome, variacao, quantidade,
        preco_unitario, custo_unitario
      ) values (
        p_user_id, v_id, null, null,
        left(coalesce(nullif(btrim(v_item ->> 'nome'), ''), 'Anúncio sem produto ligado'), 200),
        left(nullif(btrim(v_item ->> 'variacao'), ''), 80), v_qtd, v_preco, null
      );
    end if;

    if v_custo_item is null then
      v_custo_conhecido := false;
    else
      v_custo := v_custo + v_qtd * v_custo_item;
    end if;
  end loop;

  update vendas
     set custo_total = case when v_custo_conhecido then round(v_custo, 2) else null end
   where id = v_id;
  return v_id;
end;
$$;

-- Pedido cancelado no canal depois de virar venda: mesma regra da cancelar_venda.
create or replace function public.cancelar_venda_canal(
  p_user_id uuid,
  p_canal text,
  p_id_externo text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas;
begin
  select * into v_venda from vendas
    where user_id = p_user_id and canal = p_canal and id_externo = p_id_externo
    for update;
  if not found then
    return false;
  end if;
  if v_venda.status = 'cancelada' then
    return true;
  end if;

  insert into estoque_movimentos (user_id, sku_id, tipo, quantidade, venda_id, motivo)
  select v_venda.user_id, m.sku_id, 'devolucao', -m.quantidade, v_venda.id, 'pedido cancelado no canal'
  from estoque_movimentos m
  where m.venda_id = v_venda.id and m.tipo = 'venda' and m.user_id = v_venda.user_id;

  if v_venda.lancamento_id is not null then
    delete from lancamentos where id = v_venda.lancamento_id and user_id = v_venda.user_id;
  end if;

  update vendas set status = 'cancelada', lancamento_id = null, updated_at = now()
   where id = v_venda.id;
  return true;
end;
$$;

revoke all on function public.registrar_venda_canal(uuid, text, text, date, jsonb, numeric, text) from public, anon, authenticated;
revoke all on function public.cancelar_venda_canal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.registrar_venda_canal(uuid, text, text, date, jsonb, numeric, text) to service_role;
grant execute on function public.cancelar_venda_canal(uuid, text, text) to service_role;

-- ── cron: chama o tiktok-sync a cada minuto, só quando há trabalho ─────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'tiktok_sync_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'tiktok_sync_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_tiktok_sync(p_segredo text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets where name = 'tiktok_sync_secret'),
    false
  );
$fn$;
revoke all on function public.conferir_segredo_tiktok_sync(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_tiktok_sync(text) to service_role;

-- Trabalho = evento pendente, ou loja conectada sem varredura há 15 minutos.
create or replace function public.disparar_tiktok_sync()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  segredo text;
begin
  if not exists (select 1 from canal_eventos where processado_em is null and tentativas < 5)
     and not exists (
       select 1 from canal_conexoes
        where canal = 'tiktok_shop' and status = 'conectada'
          and (ultimo_sync is null or ultimo_sync < now() - interval '15 minutes')
     ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'tiktok_sync_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/tiktok-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-tiktok-sync-secret', segredo)
    );
  end if;
end;
$fn$;
revoke all on function public.disparar_tiktok_sync() from public, anon, authenticated;

select cron.schedule('tiktok-sync', '* * * * *', $$select public.disparar_tiktok_sync()$$);
