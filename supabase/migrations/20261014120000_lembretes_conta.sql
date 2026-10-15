-- GRW-33 (14/10/2026): lembretes pra conta nova.
--
-- Primeiro uso: lembrete de confirmação de e-mail, 1 hora e 24 horas depois do
-- cadastro (4 de 16 cadastros da campanha de nichos nunca confirmaram). A edge
-- function lembretes-conta decide qual cabe (_shared/lembretesConta.ts), gera
-- link novo e manda pelo Resend. Mesmo desenho de segredo do reenviar-emails:
-- gerado no Vault, conferido por RPC, nunca vira variável de ambiente.

create table if not exists public.lembretes_conta (
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  enviado_em timestamptz not null default now(),
  primary key (user_id, tipo)
);

-- Só a service role (edge function). Sem policy = ninguém de fora.
alter table public.lembretes_conta enable row level security;

-- Contas sem e-mail confirmado entre 1 hora e 7 dias de vida, com os lembretes
-- que já receberam. Lê auth.users, então só a service role executa.
create or replace function public.contas_sem_confirmacao()
returns table (user_id uuid, email text, criado_em timestamptz, enviados text[])
language sql
stable
security definer
set search_path = public
as $fn$
  select u.id, u.email::text, u.created_at,
         coalesce(array_agg(l.tipo) filter (where l.tipo is not null), '{}')
    from auth.users u
    left join public.lembretes_conta l on l.user_id = u.id
   where u.email_confirmed_at is null
     and u.email is not null
     and u.created_at <= now() - interval '1 hour'
     and u.created_at > now() - interval '7 days'
   group by u.id, u.email, u.created_at;
$fn$;

revoke all on function public.contas_sem_confirmacao() from public, anon, authenticated;
grant execute on function public.contas_sem_confirmacao() to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'lembretes_conta_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'lembretes_conta_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_lembretes_conta(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets
      where name = 'lembretes_conta_secret'),
    false
  );
$fn$;

revoke all on function public.conferir_segredo_lembretes_conta(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_lembretes_conta(text) to service_role;

-- Só chama a edge function quando existe alguma conta sem confirmação na
-- janela; a decisão fina (1h ou 24h, já recebeu?) fica na função.
create or replace function public.disparar_lembretes_conta()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  segredo text;
begin
  if not exists (
    select 1 from auth.users u
     where u.email_confirmed_at is null
       and u.created_at <= now() - interval '1 hour'
       and u.created_at > now() - interval '7 days'
  ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'lembretes_conta_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/lembretes-conta',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-conta-secret', segredo)
    );
  end if;
end;
$fn$;

revoke all on function public.disparar_lembretes_conta() from public, anon, authenticated;

select cron.schedule('lembretes-conta', '*/15 * * * *', $$select public.disparar_lembretes_conta()$$);
