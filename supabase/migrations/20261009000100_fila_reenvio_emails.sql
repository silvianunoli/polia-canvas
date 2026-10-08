-- PAY-27 (08/10/2026): fila de reenvio dos e-mails do Stripe.
--
-- Antes, e-mail que o Resend recusava só disparava o alerta
-- stripe_webhook_email_falhou: quem pagou podia ficar sem o link de criar
-- senha. Agora o stripe-webhook grava o que não saiu em emails_pendentes e a
-- edge function reenviar-emails tenta de novo (intervalos em
-- supabase/functions/_shared/reenvioEmail.ts).
--
-- Segredo do cron: gerado AQUI dentro do Vault e nunca exposto. A edge function
-- não guarda o valor; confere o que recebeu chamando
-- conferir_segredo_reenvio_emails (só service_role executa).

create table if not exists public.emails_pendentes (
  id uuid primary key default gen_random_uuid(),
  destinatario text not null,
  assunto text not null,
  texto text not null,
  html text not null,
  contexto text not null,
  -- Ativação: o link do convite expira, o reenvio gera um novo.
  regenerar_ativacao boolean not null default false,
  tentativas integer not null default 1,
  proxima_tentativa timestamptz not null default now() + interval '5 minutes',
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  desistiu_em timestamptz
);

-- Só a service role lê e escreve (webhook e reenviar-emails). Sem policy =
-- ninguém de fora, nem usuária logada.
alter table public.emails_pendentes enable row level security;

create index if not exists emails_pendentes_vencidos
  on public.emails_pendentes (proxima_tentativa)
  where enviado_em is null and desistiu_em is null;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'reenvio_emails_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'reenvio_emails_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_reenvio_emails(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets
      where name = 'reenvio_emails_secret'),
    false
  );
$fn$;

revoke all on function public.conferir_segredo_reenvio_emails(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_reenvio_emails(text) to service_role;

-- Só chama a edge function quando há e-mail vencido: o cron roda a cada 10 min
-- e quase sempre a fila está vazia.
create or replace function public.disparar_reenvio_emails()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  segredo text;
begin
  if not exists (
    select 1 from public.emails_pendentes
     where enviado_em is null and desistiu_em is null and proxima_tentativa <= now()
  ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'reenvio_emails_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/reenviar-emails',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-reenvio-emails-secret', segredo)
    );
  end if;
end;
$fn$;

revoke all on function public.disparar_reenvio_emails() from public, anon, authenticated;

select cron.schedule('reenviar-emails', '*/10 * * * *', $$select public.disparar_reenvio_emails()$$);
