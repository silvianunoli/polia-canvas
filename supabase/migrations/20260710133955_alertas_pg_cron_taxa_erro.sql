-- Checagem automática de taxa de erro interna, a cada 5 min, via pg_cron +
-- pg_net (reaproveita a captura já existente em erros_app — Fase 14 — sem
-- duplicar captura). O segredo compartilhado (ALERTAS_SECRET) fica no Vault,
-- nunca em texto puro na migration; é inserido depois via execute_sql
-- (vault.create_secret), não versionado no arquivo de migration.
create extension if not exists pg_net;

create or replace function public.checar_taxa_erro_e_alertar()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_erros integer;
  segredo text;
begin
  select count(*) into total_erros
  from public.erros_app
  where criado_em > now() - interval '10 minutes';

  if total_erros > 15 then
    select decrypted_secret into segredo from vault.decrypted_secrets where name = 'alertas_secret';
    if segredo is not null then
      perform net.http_post(
        url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/alertas-criticos',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-alertas-secret', segredo),
        body := jsonb_build_object(
          'tipo', 'erro_taxa_alta',
          'titulo', 'Taxa de erro interna acima do limite',
          'detalhes', jsonb_build_object('erros_10min', total_erros, 'limite', 15),
          'link', 'https://usepolia.com.br/admin/qualidade'
        )
      );
    end if;
  end if;
end;
$$;

select cron.schedule(
  'checar-taxa-erro-alertas',
  '*/5 * * * *',
  $$select public.checar_taxa_erro_e_alertar()$$
);
