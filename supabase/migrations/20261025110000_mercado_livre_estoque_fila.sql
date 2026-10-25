-- Fase 3c, etapa 3c.4 (VND-30): o estoque da Pólia atualiza o Mercado Livre.
-- Plano: docs/plano-fase3c-mercado-livre.md §5.
--
-- A fila canal_fila_estoque e os gatilhos que a enchem já valem para qualquer
-- canal desde a 3a.4 (só entra variação ligada de conta com "A Pólia cuida do
-- estoque" ligado). Falta só o cron do Mercado Livre olhar essa fila: sem isso,
-- o saldo esperaria a varredura de 15 minutos para subir.

create or replace function public.disparar_ml_sync()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  segredo text;
begin
  if not exists (
       select 1 from canal_eventos
        where canal = 'mercado_livre' and processado_em is null and tentativas < 5
     )
     and not exists (
       select 1 from canal_fila_estoque
        where canal = 'mercado_livre' and pendente and tentativas < 5
     )
     and not exists (
       select 1 from canal_conexoes
        where canal = 'mercado_livre' and status = 'conectada'
          and coalesce(greatest(ultimo_sync, varredura_tentada_em), '-infinity')
              < now() - interval '15 minutes'
     ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'ml_sync_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/ml-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-ml-sync-secret', segredo)
    );
  end if;
end;
$fn$;
revoke all on function public.disparar_ml_sync() from public, anon, authenticated;
