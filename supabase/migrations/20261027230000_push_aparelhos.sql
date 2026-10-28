-- AND-06 (27/10/2026): notificações push no app Android.
--
-- O app (Capacitor) pede permissão, recebe um token do Firebase Cloud
-- Messaging e grava aqui pela RPC registrar_aparelho_push. A edge function
-- push-lembretes lê os alvos pelas RPCs push_alvos_* e envia pelo FCM HTTP v1
-- (chave da conta de serviço em FIREBASE_SERVICE_ACCOUNT_B64, segredo da edge
-- function). Mesmo desenho de segredo do lembretes-conta: gerado no Vault,
-- conferido por RPC, nunca vira variável de ambiente.

create table if not exists public.push_aparelhos (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plataforma text not null default 'android',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists push_aparelhos_user_id_idx on public.push_aparelhos (user_id);

-- Sem policy: ninguém de fora lê nem escreve direto. O app passa pelas RPCs
-- abaixo; a edge function usa a service role.
alter table public.push_aparelhos enable row level security;

-- Um aparelho é de quem está logada nele agora. Se outra conta entrar no mesmo
-- celular, o token troca de dona (por isso RPC e não insert com RLS: a policy
-- de update não deixaria mexer na linha da conta anterior).
create or replace function public.registrar_aparelho_push(p_token text, p_plataforma text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'sem sessão';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'token inválido';
  end if;
  insert into public.push_aparelhos (token, user_id, plataforma)
  values (p_token, auth.uid(), coalesce(nullif(p_plataforma, ''), 'android'))
  on conflict (token) do update
    set user_id = excluded.user_id,
        plataforma = excluded.plataforma,
        atualizado_em = now();
end;
$fn$;

-- Chamada antes de sair da conta: o celular para de receber avisos da conta
-- que saiu. Só apaga token da própria conta.
create or replace function public.esquecer_aparelho_push(p_token text)
returns void
language sql
security definer
set search_path = public
as $fn$
  delete from public.push_aparelhos where token = p_token and user_id = auth.uid();
$fn$;

revoke all on function public.registrar_aparelho_push(text, text) from public, anon;
revoke all on function public.esquecer_aparelho_push(text) from public, anon;
grant execute on function public.registrar_aparelho_push(text, text) to authenticated;
grant execute on function public.esquecer_aparelho_push(text) to authenticated;

-- Preferências por tipo de aviso, ligadas por padrão (só valem pra quem deu
-- permissão no celular). Editáveis pela própria conta na policy de update de
-- profiles, que já congela plano e is_admin.
alter table public.profiles
  add column if not exists notif_push_vendas boolean not null default true,
  add column if not exists notif_push_resumo boolean not null default true;

-- Lembrete de vendas (20h de Brasília): conta com aparelho e aviso ligado, que
-- registrou alguma venda nos últimos 30 dias (usa o módulo) e nenhuma hoje.
create or replace function public.push_alvos_vendas_do_dia(p_hoje date)
returns table (user_id uuid, tokens text[])
language sql
stable
security definer
set search_path = public
as $fn$
  select a.user_id, array_agg(a.token)
    from public.push_aparelhos a
    join public.profiles p on p.id = a.user_id
   where p.notif_push_vendas
     and exists (
       select 1 from public.vendas v
        where v.user_id = a.user_id
          and v.status <> 'cancelada'
          and v.data >= p_hoje - 30
          and v.data < p_hoje
     )
     and not exists (
       select 1 from public.vendas v
        where v.user_id = a.user_id
          and v.status <> 'cancelada'
          and v.data = p_hoje
     )
   group by a.user_id;
$fn$;

-- Resumo de segunda (9h de Brasília): total e quantidade de vendas da semana
-- que fechou. Semana sem venda não recebe aviso.
create or replace function public.push_alvos_resumo_semana(p_inicio date, p_fim date)
returns table (user_id uuid, tokens text[], total numeric, quantidade integer)
language sql
stable
security definer
set search_path = public
as $fn$
  with semana as (
    select v.user_id, sum(coalesce(v.total, 0)) as total, count(*)::integer as quantidade
      from public.vendas v
     where v.status <> 'cancelada'
       and v.data between p_inicio and p_fim
     group by v.user_id
  )
  select a.user_id, array_agg(a.token), s.total, s.quantidade
    from public.push_aparelhos a
    join public.profiles p on p.id = a.user_id
    join semana s on s.user_id = a.user_id
   where p.notif_push_resumo
   group by a.user_id, s.total, s.quantidade;
$fn$;

revoke all on function public.push_alvos_vendas_do_dia(date) from public, anon, authenticated;
revoke all on function public.push_alvos_resumo_semana(date, date) from public, anon, authenticated;
grant execute on function public.push_alvos_vendas_do_dia(date) to service_role;
grant execute on function public.push_alvos_resumo_semana(date, date) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_lembretes_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_lembretes_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_push_lembretes(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets
      where name = 'push_lembretes_secret'),
    false
  );
$fn$;

revoke all on function public.conferir_segredo_push_lembretes(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_push_lembretes(text) to service_role;

-- Só chama a edge function quando existe algum aparelho cadastrado; a escolha
-- de quem recebe fica nas RPCs push_alvos_*.
create or replace function public.disparar_push_lembretes(p_tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  segredo text;
begin
  if not exists (select 1 from public.push_aparelhos) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'push_lembretes_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/push-lembretes',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-lembretes-secret', segredo),
      body := jsonb_build_object('tipo', p_tipo)
    );
  end if;
end;
$fn$;

revoke all on function public.disparar_push_lembretes(text) from public, anon, authenticated;

-- 23h UTC = 20h de Brasília (sem horário de verão desde 2019).
select cron.schedule('push-vendas-do-dia', '0 23 * * *', $$select public.disparar_push_lembretes('vendas_do_dia')$$);
-- Segunda, 12h UTC = 9h de Brasília.
select cron.schedule('push-resumo-semana', '0 12 * * 1', $$select public.disparar_push_lembretes('resumo_semana')$$);
