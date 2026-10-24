-- Fase 3a, etapa 3a.4 (VND-05): o estoque da Pólia atualiza o TikTok Shop.
-- Plano: docs/plano-fase3a-tiktok-shop.md §2 e §5.
--
-- Com "A Pólia cuida do estoque" ligado na conexão, todo movimento de estoque de
-- uma variação ligada a anúncio (venda em qualquer canal, entrada, perda,
-- contagem, cancelamento) põe a variação numa fila. O tiktok-sync manda o SALDO
-- (não a diferença) para o TikTok: reenviar não duplica nada, e a Pólia vira a
-- fonte da verdade da quantidade. Saldo negativo vai como zero.

-- ── fila de estoque: uma linha por variação e canal ───────────────────────
create table if not exists public.canal_fila_estoque (
  user_id uuid not null references auth.users (id) on delete cascade,
  canal text not null check (canal in ('tiktok_shop', 'shopee')),
  sku_id uuid not null references public.produto_skus (id) on delete cascade,
  pendente boolean not null default true,
  pedido_em timestamptz not null default now(),
  enviado_em timestamptz,
  tentativas integer not null default 0,
  erro text check (erro is null or char_length(erro) <= 500),
  primary key (canal, sku_id)
);
create index if not exists canal_fila_estoque_pendentes_idx
  on public.canal_fila_estoque (pedido_em)
  where pendente;

alter table public.canal_fila_estoque enable row level security;
revoke all on public.canal_fila_estoque from public, anon, authenticated;
grant all on public.canal_fila_estoque to service_role;

-- Põe na fila as variações ligadas a anúncio de loja que a Pólia cuida.
create or replace function public.enfileirar_estoque_canal(p_sku_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  insert into canal_fila_estoque (user_id, canal, sku_id, pendente, pedido_em, tentativas, erro)
  select distinct v.user_id, v.canal, v.sku_id, true, now(), 0, null
    from anuncio_vinculos v
    join canal_conexoes c
      on c.user_id = v.user_id and c.canal = v.canal
     and c.status = 'conectada' and c.cuida_estoque
   where v.sku_id = any (p_sku_ids) and v.sincroniza_estoque
  on conflict (canal, sku_id) do update
     set pendente = true, pedido_em = now(), tentativas = 0, erro = null;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

create or replace function public.estoque_movimento_enfileira_canal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enfileirar_estoque_canal(array[new.sku_id]);
  return new;
end;
$$;

drop trigger if exists estoque_movimento_enfileira_canal on public.estoque_movimentos;
create trigger estoque_movimento_enfileira_canal
  after insert on public.estoque_movimentos
  for each row execute function public.estoque_movimento_enfileira_canal();

-- Anúncio ligado depois que ela já ligou "cuida do estoque": manda o saldo na hora.
create or replace function public.anuncio_vinculo_enfileira_canal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enfileirar_estoque_canal(array[new.sku_id]);
  return new;
end;
$$;

drop trigger if exists anuncio_vinculo_enfileira_canal on public.anuncio_vinculos;
create trigger anuncio_vinculo_enfileira_canal
  after insert or update of sku_id on public.anuncio_vinculos
  for each row execute function public.anuncio_vinculo_enfileira_canal();

revoke all on function public.enfileirar_estoque_canal(uuid[]) from public, anon, authenticated;
revoke all on function public.estoque_movimento_enfileira_canal() from public, anon, authenticated;
revoke all on function public.anuncio_vinculo_enfileira_canal() from public, anon, authenticated;
grant execute on function public.enfileirar_estoque_canal(uuid[]) to service_role;

-- ── cron: estoque pendente também é trabalho ──────────────────────────────
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
     and not exists (select 1 from canal_fila_estoque where pendente and tentativas < 5)
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
