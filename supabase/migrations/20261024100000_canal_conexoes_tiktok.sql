-- Fase 3a, etapa 3a.1 (VND-05): conexão com o TikTok Shop.
-- Plano: docs/plano-fase3a-tiktok-shop.md.
--
-- Diferente do Google Agenda (token em coluna, protegida por RLS), aqui o token
-- fica no Supabase Vault: a política de segurança v1.0 e o questionário do
-- TikTok prometem isso. A tabela guarda só o id do segredo; ler e gravar o
-- token passa por RPC que só o service role executa.

-- ── canal_conexoes ─────────────────────────────────────────────────────────
create table if not exists public.canal_conexoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canal text not null check (canal in ('tiktok_shop', 'shopee')),
  status text not null default 'pendente'
    check (status in ('pendente', 'conectada', 'erro')),
  -- state do OAuth: gerado ao clicar em Conectar, conferido na volta, zerado depois.
  state_pendente text check (state_pendente is null or char_length(state_pendente) <= 100),
  shop_id text check (shop_id is null or char_length(shop_id) <= 100),
  shop_cipher text check (shop_cipher is null or char_length(shop_cipher) <= 200),
  loja_nome text check (loja_nome is null or char_length(loja_nome) <= 200),
  regiao text check (regiao is null or char_length(regiao) <= 10),
  access_secret_id uuid,
  refresh_secret_id uuid,
  access_expira_em timestamptz,
  refresh_expira_em timestamptz,
  cuida_estoque boolean not null default false,
  ultimo_sync timestamptz,
  ultimo_erro text check (ultimo_erro is null or char_length(ultimo_erro) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, canal)
);

-- O webhook chega com o shop_id: precisa achar a conta dona da loja.
create unique index if not exists canal_conexoes_canal_shop_uniq
  on public.canal_conexoes (canal, shop_id)
  where shop_id is not null;

-- ── anuncio_vinculos ───────────────────────────────────────────────────────
-- SKU do canal ↔ variação da Pólia. Preenchida na etapa 3a.2 (prévia que ela aprova).
create table if not exists public.anuncio_vinculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canal text not null check (canal in ('tiktok_shop', 'shopee')),
  produto_externo_id text not null check (char_length(produto_externo_id) between 1 and 100),
  sku_externo_id text not null check (char_length(sku_externo_id) between 1 and 100),
  sku_id uuid not null references public.produto_skus (id) on delete cascade,
  sincroniza_estoque boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, canal, sku_externo_id)
);
create index if not exists anuncio_vinculos_sku_idx on public.anuncio_vinculos (sku_id);

-- Nenhuma das duas é lida pelo navegador: status e vínculos saem por server
-- function, que devolve só os campos que a tela usa. Deny-all para anon e authenticated.
alter table public.canal_conexoes enable row level security;
alter table public.anuncio_vinculos enable row level security;
revoke all on public.canal_conexoes, public.anuncio_vinculos from public, anon, authenticated;

-- ── tokens no Vault ────────────────────────────────────────────────────────
create or replace function public.canal_token_salvar(
  p_conexao_id uuid,
  p_access text,
  p_refresh text,
  p_access_expira timestamptz,
  p_refresh_expira timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v public.canal_conexoes%rowtype;
begin
  if p_access is null or p_refresh is null then
    raise exception 'token vazio';
  end if;

  select * into v from public.canal_conexoes where id = p_conexao_id for update;
  if not found then
    raise exception 'conexão não encontrada';
  end if;

  if v.access_secret_id is null then
    v.access_secret_id := vault.create_secret(p_access, 'canal:' || p_conexao_id || ':access');
  else
    perform vault.update_secret(v.access_secret_id, p_access);
  end if;

  if v.refresh_secret_id is null then
    v.refresh_secret_id := vault.create_secret(p_refresh, 'canal:' || p_conexao_id || ':refresh');
  else
    perform vault.update_secret(v.refresh_secret_id, p_refresh);
  end if;

  update public.canal_conexoes
     set access_secret_id = v.access_secret_id,
         refresh_secret_id = v.refresh_secret_id,
         access_expira_em = p_access_expira,
         refresh_expira_em = p_refresh_expira,
         updated_at = now()
   where id = p_conexao_id;
end;
$fn$;

create or replace function public.canal_token_ler(p_conexao_id uuid)
returns table (access_token text, refresh_token text, access_expira_em timestamptz, refresh_expira_em timestamptz)
language sql
security definer
set search_path = ''
stable
as $fn$
  select a.decrypted_secret, r.decrypted_secret, c.access_expira_em, c.refresh_expira_em
    from public.canal_conexoes c
    left join vault.decrypted_secrets a on a.id = c.access_secret_id
    left join vault.decrypted_secrets r on r.id = c.refresh_secret_id
   where c.id = p_conexao_id;
$fn$;

-- Apagar a conexão (desconectar, exclusão da conta por cascade) leva os segredos junto.
create or replace function public.canal_conexoes_apagar_segredos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  delete from vault.secrets
   where id in (old.access_secret_id, old.refresh_secret_id);
  return old;
end;
$fn$;

drop trigger if exists canal_conexoes_apagar_segredos on public.canal_conexoes;
create trigger canal_conexoes_apagar_segredos
  after delete on public.canal_conexoes
  for each row execute function public.canal_conexoes_apagar_segredos();

revoke all on function public.canal_token_salvar(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.canal_token_ler(uuid) from public, anon, authenticated;
revoke all on function public.canal_conexoes_apagar_segredos() from public, anon, authenticated;
grant execute on function public.canal_token_salvar(uuid, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.canal_token_ler(uuid) to service_role;
grant all on public.canal_conexoes, public.anuncio_vinculos to service_role;
