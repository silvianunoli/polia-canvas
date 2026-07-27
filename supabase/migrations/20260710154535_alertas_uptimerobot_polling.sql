-- Plano grátis do UptimeRobot bloqueou webhook/Telegram nativo — em vez de
-- esperar o UptimeRobot nos chamar, a gente pergunta pra API dele a cada 5 min
-- se o monitor está no ar (polling invertido). Segredos (API key do
-- UptimeRobot, ALERTAS_SECRET) ficam só no Vault, nunca em texto puro aqui.
create extension if not exists http;

create or replace function public.checar_uptimerobot_e_alertar()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  api_key text;
  resposta http_response;
  corpo jsonb;
  status_monitor int;
  segredo_alertas text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'uptimerobot_api_key';
  if api_key is null then
    return;
  end if;

  select * into resposta from http((
    'POST',
    'https://api.uptimerobot.com/v2/getMonitors',
    ARRAY[http_header('Content-Type', 'application/x-www-form-urlencoded')],
    'application/x-www-form-urlencoded',
    'api_key=' || api_key || '&format=json&search=usepolia'
  )::http_request);

  corpo := resposta.content::jsonb;
  status_monitor := (corpo->'monitors'->0->>'status')::int;

  -- Códigos da API do UptimeRobot: 2 = up, 8 = seems down, 9 = down.
  if status_monitor in (8, 9) then
    select decrypted_secret into segredo_alertas from vault.decrypted_secrets where name = 'alertas_secret';
    if segredo_alertas is not null then
      perform net.http_post(
        url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/alertas-criticos',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-alertas-secret', segredo_alertas),
        body := jsonb_build_object(
          'tipo', 'health_down',
          'titulo', 'Health-check externo indica queda (UptimeRobot)',
          'detalhes', jsonb_build_object('status_uptimerobot', status_monitor),
          'link', 'https://usepolia.com.br/admin/qualidade'
        )
      );
    end if;
  end if;
end;
$$;

select cron.schedule(
  'checar-uptimerobot-alertas',
  '*/5 * * * *',
  $$select public.checar_uptimerobot_e_alertar()$$
);
