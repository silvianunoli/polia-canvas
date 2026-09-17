-- Founder Dashboard, bloco 1: colunas de baseline no snapshot diário, dedup de
-- alertas e função de disparo do monitor (pg_cron -> Edge Function founder-monitor).
-- Aplicada em produção em 17/09/2026 (version 20260917162924). O segredo
-- `founder_monitor_secret` foi criado no Vault fora desta migration (vault.create_secret)
-- e espelhado como FOUNDER_MONITOR_SECRET nos secrets das Edge Functions.

alter table public.founder_metricas_diarias
  add column if not exists dau integer not null default 0,
  add column if not exists wau integer not null default 0,
  add column if not exists mau integer not null default 0,
  add column if not exists sessoes integer not null default 0,
  add column if not exists api_requests integer not null default 0,
  add column if not exists api_erros integer not null default 0,
  add column if not exists api_p95_ms integer,
  add column if not exists ia_chamadas integer not null default 0,
  add column if not exists ia_falhas integer not null default 0,
  add column if not exists jobs_falhos integer not null default 0,
  add column if not exists pagamentos_falhos integer not null default 0,
  add column if not exists receita_centavos bigint not null default 0;

alter table public.founder_alertas
  add column if not exists chave_dedup text,
  add column if not exists origem text not null default 'monitor';

create unique index if not exists founder_alertas_dedup_aberto_idx
  on public.founder_alertas (chave_dedup)
  where status = 'aberto' and chave_dedup is not null;

-- O schema cron não sai pelo PostgREST; o monitor (service role) lê por aqui.
create or replace function public.founder_jobs_falhos(p_horas integer default 24)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from cron.job_run_details
  where status = 'failed'
    and start_time > now() - make_interval(hours => p_horas);
$$;
revoke execute on function public.founder_jobs_falhos(integer) from public, anon, authenticated;

create or replace function public.disparar_founder_monitor()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
begin
  select decrypted_secret into segredo
  from vault.decrypted_secrets
  where name = 'founder_monitor_secret';
  if segredo is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/founder-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-founder-secret', segredo
    ),
    body := '{}'::jsonb
  );
end;
$$;
revoke execute on function public.disparar_founder_monitor() from public, anon, authenticated;

select cron.schedule('founder-monitor', '*/10 * * * *', 'select public.disparar_founder_monitor()');
