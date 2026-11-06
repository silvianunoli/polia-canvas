-- Aviso da véspera (ONE-174, decisão da Sil em 05/11/2026; D7 de
-- docs/plano-quadro-de-pedidos.md). Às 18h de Brasília, a dona com pedido aberto
-- pra entregar amanhã recebe um e-mail só, com os pedidos do dia, e um push nos
-- aparelhos cadastrados. Sem entrega amanhã, não sai nada.
--
-- Esta migration não liga o envio: o cron entra em 20261105220100, depois do
-- e-mail de teste aprovado pela Sil.

-- Vale pros dois canais, ligado por padrão. Editável pela própria conta na
-- policy de update de profiles, que já congela plano e is_admin.
alter table public.profiles
  add column if not exists notif_entregas boolean not null default true;

-- Um aviso por dona por dia: a função marca aqui antes de enviar, como o
-- lembretes_conta. Sem policy: só a service role lê e escreve.
create table if not exists public.entregas_amanha_envios (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, dia)
);

alter table public.entregas_amanha_envios enable row level security;
revoke all on public.entregas_amanha_envios from anon, authenticated;

-- Quem recebe: pedido com entrega no dia, ainda não entregue nem cancelado, conta
-- com e-mail confirmado e o aviso ligado, que ainda não recebeu o aviso desse dia.
create or replace function public.alvos_entregas_amanha(p_amanha date)
returns table (user_id uuid, email text, tokens text[], pedidos jsonb)
language sql
stable
security definer
set search_path = public
as $fn$
  with abertos as (
    select v.user_id,
           jsonb_agg(
             jsonb_build_object(
               'cliente', v.cliente_nome,
               'status', v.status,
               'total', v.total,
               'itens', (
                 select coalesce(
                   jsonb_agg(
                     jsonb_build_object(
                       'nome', i.produto_nome,
                       'variacao', i.variacao,
                       'quantidade', i.quantidade
                     )
                     order by i.created_at
                   ),
                   '[]'::jsonb
                 )
                 from public.venda_itens i
                 where i.venda_id = v.id
               )
             )
             order by v.created_at
           ) as pedidos
      from public.vendas v
     where v.entrega_em = p_amanha
       and v.andamento in ('a_fazer', 'em_producao', 'pronto')
       and v.status <> 'cancelada'
     group by v.user_id
  )
  select a.user_id,
         u.email::text,
         (select coalesce(array_agg(d.token), '{}'::text[])
            from public.push_aparelhos d
           where d.user_id = a.user_id),
         a.pedidos
    from abertos a
    join public.profiles p on p.id = a.user_id
    join auth.users u on u.id = a.user_id
   where p.notif_entregas
     and u.email is not null
     and u.email_confirmed_at is not null
     and not exists (
       select 1 from public.entregas_amanha_envios e
        where e.user_id = a.user_id and e.dia = p_amanha
     );
$fn$;

revoke all on function public.alvos_entregas_amanha(date) from public, anon, authenticated;
grant execute on function public.alvos_entregas_amanha(date) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'entregas_amanha_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'entregas_amanha_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_entregas_amanha(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets
      where name = 'entregas_amanha_secret'),
    false
  );
$fn$;

revoke all on function public.conferir_segredo_entregas_amanha(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_entregas_amanha(text) to service_role;

-- Só chama a edge function quando existe pedido aberto pra amanhã; a escolha de
-- quem recebe fica na alvos_entregas_amanha.
create or replace function public.disparar_entregas_amanha()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  segredo text;
begin
  if not exists (
    select 1 from public.vendas v
     where v.entrega_em = (now() at time zone 'America/Sao_Paulo')::date + 1
       and v.andamento in ('a_fazer', 'em_producao', 'pronto')
       and v.status <> 'cancelada'
  ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'entregas_amanha_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/entregas-amanha',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-entregas-amanha-secret', segredo),
      body := '{}'::jsonb
    );
  end if;
end;
$fn$;

revoke all on function public.disparar_entregas_amanha() from public, anon, authenticated;
