-- Módulo Social — Fase 2 (publicador).
-- Handoff: handoff-modulo-social-polia.md, Seção 5.

create extension if not exists pg_cron;

-- Token de longa duração do Instagram Graph API. Singleton (id sempre 1).
-- Sem NENHUMA policy: só service_role acessa (Edge Functions), igual a
-- google_calendar_conexoes. access_token/expira_em NUNCA vão pro client.
create table integracao_instagram (
  id int primary key default 1 check (id = 1),
  access_token text,
  ig_user_id text,
  expira_em timestamptz,
  atualizado_em timestamptz not null default now()
);
insert into integracao_instagram (id) values (1);
alter table integracao_instagram enable row level security;
comment on table integracao_instagram is 'Token de longa duração do Instagram (@usepolia). Acesso SOMENTE via service role em Edge Functions. RLS sem nenhuma policy = ninguém acessa via client.';

-- Reivindica atomicamente os posts prontos pra publicar: marca publicando
-- ANTES de qualquer chamada de API, com FOR UPDATE SKIP LOCKED pra não
-- publicar em duplicidade se duas execuções do cron coincidirem (R do
-- publisher, handoff Seção 5).
create or replace function public.pegar_e_travar_posts_agendados()
returns setof social_posts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update social_posts
  set status = 'publicando'
  where id in (
    select id from social_posts
    where status = 'agendado' and scheduled_at <= now()
    order by scheduled_at
    for update skip locked
  )
  returning *;
end;
$$;

-- Disparo do publisher a cada minuto via pg_net (mesmo padrão de
-- checar_taxa_erro_e_alertar): segredo compartilhado no Vault, nunca em
-- texto puro na migration.
create or replace function public.disparar_social_publisher()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'social_cron_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/social-publisher',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-social-cron-secret', segredo),
      body := '{}'::jsonb
    );
  end if;
end;
$$;

select cron.schedule('social-publisher-cada-minuto', '* * * * *', $$select public.disparar_social_publisher()$$);

-- Métricas diárias (posts publicados nos últimos 28 dias). 09:00 UTC = 06:00
-- America/Sao_Paulo, cedo o bastante pra já ter o dado do dia anterior.
create or replace function public.disparar_social_metricas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'social_cron_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/social-metricas',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-social-cron-secret', segredo),
      body := '{}'::jsonb
    );
  end if;
end;
$$;

select cron.schedule('social-metricas-diario', '0 9 * * *', $$select public.disparar_social_metricas()$$);

-- Renovação semanal do token de longa duração (segunda-feira, 10:00 UTC).
create or replace function public.disparar_social_token_renovar()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'social_cron_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/social-token-renovar',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-social-cron-secret', segredo),
      body := '{}'::jsonb
    );
  end if;
end;
$$;

select cron.schedule('social-token-renovar-semanal', '0 10 * * 1', $$select public.disparar_social_token_renovar()$$);
