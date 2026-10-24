-- Revisão de segurança da Fase 3a (TikTok Shop, VND-26). Cinco endurecimentos:
-- 1. vínculo de anúncio só aponta para variação da mesma conta (garantia no banco);
-- 2. varredura que falha ou fica sem Pro não faz o cron chamar o sync todo minuto;
-- 3. trava para duas execuções do tiktok-sync não renovarem o mesmo token juntas;
-- 4. canal_eventos processado some depois de 7 dias (o que o plano promete);
-- 5. funções security definer novas com pg_temp por último no search_path.

-- ── 1. vínculo e variação da mesma dona ────────────────────────────────────
-- Hoje o servidor confere, mas o envio de estoque lê o saldo só pelo sku_id:
-- se uma regressão gravar variação de outra conta, o banco recusa.
alter table public.produto_skus
  add constraint produto_skus_id_user_uniq unique (id, user_id);
alter table public.anuncio_vinculos
  drop constraint if exists anuncio_vinculos_sku_id_fkey;
alter table public.anuncio_vinculos
  add constraint anuncio_vinculos_sku_da_dona_fkey
  foreign key (sku_id, user_id) references public.produto_skus (id, user_id) on delete cascade;

-- ── 2. tentativa de varredura separada do último sync ─────────────────────
-- ultimo_sync só avança com varredura certa (é o "desde" da próxima). A tentativa
-- avança sempre, então erro ou falta de Pro esperam 15 minutos como o resto.
alter table public.canal_conexoes
  add column if not exists varredura_tentada_em timestamptz;

-- ── 3. trava do tiktok-sync ───────────────────────────────────────────────
-- Arrendamento curto em vez de advisory lock: cada RPC do PostgREST cai numa
-- conexão do pool, e a trava de sessão não sobreviveria entre as chamadas.
create table if not exists public.canal_sync_travas (
  canal text primary key,
  ate timestamptz not null
);
alter table public.canal_sync_travas enable row level security;
revoke all on public.canal_sync_travas from public, anon, authenticated;

create or replace function public.pegar_trava_sync(p_canal text, p_segundos integer default 120)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  pegou boolean;
begin
  insert into canal_sync_travas (canal, ate)
  values (p_canal, now() + make_interval(secs => p_segundos))
  on conflict (canal) do update set ate = excluded.ate
    where canal_sync_travas.ate < now()
  returning true into pegou;
  return coalesce(pegou, false);
end;
$fn$;

create or replace function public.soltar_trava_sync(p_canal text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  update canal_sync_travas set ate = now() where canal = p_canal;
$fn$;

revoke all on function public.pegar_trava_sync(text, integer) from public, anon, authenticated;
revoke all on function public.soltar_trava_sync(text) from public, anon, authenticated;
grant execute on function public.pegar_trava_sync(text, integer) to service_role;
grant execute on function public.soltar_trava_sync(text) to service_role;

-- O cron passa a olhar a tentativa mais recente, não só o último sync certo.
create or replace function public.disparar_tiktok_sync()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  segredo text;
begin
  if not exists (select 1 from canal_eventos where processado_em is null and tentativas < 5)
     and not exists (select 1 from canal_fila_estoque where pendente and tentativas < 5)
     and not exists (
       select 1 from canal_conexoes
        where canal = 'tiktok_shop' and status = 'conectada'
          and coalesce(greatest(ultimo_sync, varredura_tentada_em), '-infinity')
              < now() - interval '15 minutes'
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

-- ── 4. canal_eventos some em 7 dias ───────────────────────────────────────
-- Só shop_id e order_id moram ali, mas o plano e o questionário de segurança
-- prometem payload mínimo apagado em 7 dias.
select cron.unschedule('limpar-canal-eventos')
  where exists (select 1 from cron.job where jobname = 'limpar-canal-eventos');
select cron.schedule(
  'limpar-canal-eventos',
  '17 4 * * *',
  $$delete from public.canal_eventos where processado_em < now() - interval '7 days'$$
);

-- ── 5. search_path das funções security definer da Fase 3a ────────────────
alter function public.registrar_venda_canal(uuid, text, text, date, jsonb, numeric, text)
  set search_path = public, pg_temp;
alter function public.cancelar_venda_canal(uuid, text, text)
  set search_path = public, pg_temp;
alter function public.enfileirar_estoque_canal(uuid[])
  set search_path = public, pg_temp;
alter function public.estoque_movimento_enfileira_canal()
  set search_path = public, pg_temp;
alter function public.anuncio_vinculo_enfileira_canal()
  set search_path = public, pg_temp;
