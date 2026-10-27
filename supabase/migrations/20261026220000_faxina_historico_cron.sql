-- Faxina do histórico do pg_cron (FND-11). cron.job_run_details guarda toda
-- execução desde 07/07 e o pg_cron não apaga sozinho: em 26/10 eram 308 mil
-- linhas (54 MB), 89% com mais de 8 dias. O /founder lê no máximo 168 h, então
-- fica o histórico de 8 dias; o raiox-mensal roda só no dia 1, e dele ficam 40
-- dias para o mês anterior continuar visível. É log operacional: apagar não
-- mexe em dado de usuária.

create or replace function public.faxina_historico_cron()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_apagadas bigint;
begin
  delete from cron.job_run_details d
   where d.end_time < now() - case
           when d.jobid in (select jobid from cron.job where jobname = 'raiox-mensal')
             then interval '40 days'
           else interval '8 days'
         end;
  get diagnostics v_apagadas = row_count;
  return v_apagadas;
end;
$fn$;

revoke all on function public.faxina_historico_cron() from public, anon, authenticated;

select cron.unschedule('faxina-historico-cron')
  where exists (select 1 from cron.job where jobname = 'faxina-historico-cron');
select cron.schedule(
  'faxina-historico-cron',
  '37 4 * * *',
  $$select public.faxina_historico_cron()$$
);

-- Primeira faxina já na aplicação.
select public.faxina_historico_cron();
