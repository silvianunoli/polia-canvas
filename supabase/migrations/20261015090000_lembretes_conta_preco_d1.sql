-- Lembrete do primeiro preço (preco_d1, 15/10/2026), segundo uso da tabela
-- lembretes_conta (migração 20261014120000).
--
-- Conta com e-mail confirmado, criada entre 20 e 72 horas atrás, que ainda não
-- calculou nenhum preço (nenhum produto com calculadora_breakdown) recebe um
-- e-mail só no dia seguinte. A edge function lembretes-conta decide e monta a
-- copy pelo nicho do anúncio (utm_content da origem_campanha), e marca
-- preco_d1 em lembretes_conta antes de enviar.

-- Contas na janela do preco_d1, com o utm_content do anúncio de origem e se já
-- receberam o lembrete. Lê auth.users, então só a service role executa.
create or replace function public.contas_sem_preco()
returns table (
  user_id uuid,
  email text,
  criado_em timestamptz,
  utm_content text,
  ja_recebeu boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select u.id,
         u.email::text,
         u.created_at,
         nullif(u.raw_user_meta_data -> 'origem_campanha' ->> 'utm_content', ''),
         exists (
           select 1 from public.lembretes_conta l
            where l.user_id = u.id and l.tipo = 'preco_d1'
         )
    from auth.users u
   where u.email_confirmed_at is not null
     and u.email is not null
     and u.created_at <= now() - interval '20 hours'
     and u.created_at > now() - interval '72 hours'
     and not exists (
       select 1 from public.produtos p
        where p.user_id = u.id and p.calculadora_breakdown is not null
     )
   order by u.created_at;
$fn$;

revoke all on function public.contas_sem_preco() from public, anon, authenticated;
grant execute on function public.contas_sem_preco() to service_role;

-- Mesma função do cron, agora com a segunda checagem: chama a edge function
-- quando há conta sem confirmação na janela OU conta elegível pro preco_d1
-- (confirmada, 20 a 72 horas, sem preço calculado e sem o lembrete). As duas
-- são EXISTS sobre a janela de created_at; a decisão fina segue na função.
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
  ) and not exists (
    select 1 from auth.users u
     where u.email_confirmed_at is not null
       and u.email is not null
       and u.created_at <= now() - interval '20 hours'
       and u.created_at > now() - interval '72 hours'
       and not exists (
         select 1 from public.lembretes_conta l
          where l.user_id = u.id and l.tipo = 'preco_d1'
       )
       and not exists (
         select 1 from public.produtos p
          where p.user_id = u.id and p.calculadora_breakdown is not null
       )
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
