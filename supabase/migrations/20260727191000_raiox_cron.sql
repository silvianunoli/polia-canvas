-- Cron mensal do Raio-x (Fase 3, Projete): dispara a Edge Function
-- raiox-mensal-cron no dia 1 de cada mês, mesmo padrão de
-- checar_taxa_erro_e_alertar() (segredo no Vault, nunca em texto puro aqui).
-- O secret precisa ser criado depois via execute_sql (não versionado):
--   select vault.create_secret('<segredo gerado>', 'raiox_cron_secret');
-- e configurado na Edge Function: supabase secrets set RAIOX_CRON_SECRET=...
create extension if not exists pg_net;

create or replace function public.disparar_raiox_mensal()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  segredo text;
begin
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'raiox_cron_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/raiox-mensal-cron',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-raiox-cron-secret', segredo)
    );
  end if;
end;
$$;

select cron.schedule(
  'raiox-mensal',
  '0 9 1 * *',
  $$select public.disparar_raiox_mensal()$$
);
