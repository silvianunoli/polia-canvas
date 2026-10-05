-- O stripe-webhook precisa saber se o e-mail de quem pagou já tem conta, pra
-- reaproveitar em vez de tentar criar de novo (generateLink type "invite" falha
-- com "já cadastrado" e a compra paga fica sem conta ligada: achado 05/10/2026,
-- primeira compra real). A leitura direta de auth.users pela API não é
-- garantida (o schema auth não é exposto pelo PostgREST), então a busca vira
-- função no schema public, chamada via rpc com a service role.
--
-- security definer + search_path vazio: a função lê auth.users, que o chamador
-- não pode ler. Execução só pra service_role: anon e authenticated não
-- enumeram e-mails de contas.
create or replace function public.buscar_user_id_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.buscar_user_id_por_email(text) from public, anon, authenticated;
grant execute on function public.buscar_user_id_por_email(text) to service_role;
