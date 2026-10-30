-- Agenda das redes (ONE-154, fases 1 e 2): a cliente do Pro conecta o TikTok e o
-- Instagram DELA e a Pólia publica os posts agendados na conta dela.
-- Plano: ../RED-37-plano-agenda-redes-clientes-2026-10-29.md (raiz do workspace).
--
-- Mesmo desenho do canal_conexoes (20261024100000): o token fica no Supabase
-- Vault, a tabela guarda só o id do segredo, e ler/gravar token passa por RPC que
-- só o service role executa. Tabela nova (e não canal_conexoes) porque as colunas
-- de lá são de loja (shop_id, shop_cipher, estoque) e aqui é conta de criadora.
--
-- O módulo social antigo (fdp_arquivo.social_posts, contas_sociais) era de uma
-- conta só, sem user_id: não serve para várias clientes e não volta.
--
-- APLICAR pelo MCP apply_migration, só com o ok da Sil. Idempotente.

-- ── 1. redes_conexoes ──────────────────────────────────────────────────────
create table if not exists public.redes_conexoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rede text not null check (rede in ('tiktok', 'instagram')),
  status text not null default 'pendente'
    check (status in ('pendente', 'conectada', 'erro')),
  -- state do OAuth: gerado no Conectar, conferido na volta, zerado depois.
  state_pendente text check (state_pendente is null or char_length(state_pendente) <= 100),
  -- TikTok: open_id. Instagram: user_id da conta profissional.
  conta_id text check (conta_id is null or char_length(conta_id) <= 100),
  conta_usuario text check (conta_usuario is null or char_length(conta_usuario) <= 100),
  conta_nome text check (conta_nome is null or char_length(conta_nome) <= 200),
  conta_foto_url text check (
    conta_foto_url is null or (char_length(conta_foto_url) <= 2000 and conta_foto_url like 'https://%')
  ),
  escopos text check (escopos is null or char_length(escopos) <= 500),
  access_secret_id uuid,
  -- O Instagram não tem token de renovação: o próprio token longo se renova.
  refresh_secret_id uuid,
  access_expira_em timestamptz,
  refresh_expira_em timestamptz,
  -- Instagram só renova token com mais de 24 h de vida: guarda quando foi emitido.
  renovado_em timestamptz,
  ultimo_erro text check (ultimo_erro is null or char_length(ultimo_erro) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, rede)
);

create index if not exists redes_conexoes_renovar_idx
  on public.redes_conexoes (rede, access_expira_em)
  where status = 'conectada';

-- O navegador não lê: status sai por server function, só com os campos da tela.
alter table public.redes_conexoes enable row level security;
revoke all on public.redes_conexoes from public, anon, authenticated;
grant all on public.redes_conexoes to service_role;

-- ── 2. tokens no Vault ─────────────────────────────────────────────────────
create or replace function public.redes_token_salvar(
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
  v public.redes_conexoes%rowtype;
begin
  if p_access is null then
    raise exception 'token vazio';
  end if;

  select * into v from public.redes_conexoes where id = p_conexao_id for update;
  if not found then
    raise exception 'conexão não encontrada';
  end if;

  if v.access_secret_id is null then
    v.access_secret_id := vault.create_secret(p_access, 'redes:' || p_conexao_id || ':access');
  else
    perform vault.update_secret(v.access_secret_id, p_access);
  end if;

  if p_refresh is not null then
    if v.refresh_secret_id is null then
      v.refresh_secret_id := vault.create_secret(p_refresh, 'redes:' || p_conexao_id || ':refresh');
    else
      perform vault.update_secret(v.refresh_secret_id, p_refresh);
    end if;
  end if;

  update public.redes_conexoes
     set access_secret_id = v.access_secret_id,
         refresh_secret_id = v.refresh_secret_id,
         access_expira_em = p_access_expira,
         refresh_expira_em = coalesce(p_refresh_expira, refresh_expira_em),
         renovado_em = now(),
         updated_at = now()
   where id = p_conexao_id;
end;
$fn$;

create or replace function public.redes_token_ler(p_conexao_id uuid)
returns table (access_token text, refresh_token text, access_expira_em timestamptz, refresh_expira_em timestamptz)
language sql
security definer
set search_path = ''
stable
as $fn$
  select a.decrypted_secret, r.decrypted_secret, c.access_expira_em, c.refresh_expira_em
    from public.redes_conexoes c
    left join vault.decrypted_secrets a on a.id = c.access_secret_id
    left join vault.decrypted_secrets r on r.id = c.refresh_secret_id
   where c.id = p_conexao_id;
$fn$;

-- Desconectar ou excluir a conta da Pólia (cascade) leva os segredos junto.
create or replace function public.redes_conexoes_apagar_segredos()
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

drop trigger if exists redes_conexoes_apagar_segredos on public.redes_conexoes;
create trigger redes_conexoes_apagar_segredos
  after delete on public.redes_conexoes
  for each row execute function public.redes_conexoes_apagar_segredos();

revoke all on function public.redes_token_salvar(uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.redes_token_ler(uuid) from public, anon, authenticated;
revoke all on function public.redes_conexoes_apagar_segredos() from public, anon, authenticated;
grant execute on function public.redes_token_salvar(uuid, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.redes_token_ler(uuid) to service_role;

-- ── 3. posts ───────────────────────────────────────────────────────────────
-- Um post (legenda + mídias) sai em uma ou duas redes; cada rede é um destino
-- com o próprio status e, no TikTok, as escolhas que as regras dele exigem que a
-- dona da conta faça em todo post (Content Sharing Guidelines). Nenhuma escolha
-- tem padrão "ligado": privacidade começa vazia e interações começam desligadas.
--
-- O navegador só LÊ os próprios posts. Criar, agendar e cancelar passa por
-- server function, que confere as regras do TikTok antes de gravar.
create table if not exists public.redes_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('video', 'fotos')),
  -- TikTok aceita 2.200 caracteres na legenda; Instagram também.
  legenda text not null default '' check (char_length(legenda) <= 2200),
  -- Post de fotos no TikTok tem título próprio (até 90 caracteres).
  titulo text check (titulo is null or char_length(titulo) <= 90),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendado', 'publicando', 'publicado', 'parcial', 'erro', 'cancelado')),
  agendado_para timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'rascunho' or status = 'cancelado' or agendado_para is not null)
);
create index if not exists redes_posts_user_idx on public.redes_posts (user_id, agendado_para desc);
create index if not exists redes_posts_fila_idx on public.redes_posts (agendado_para)
  where status = 'agendado';

create table if not exists public.redes_post_midias (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.redes_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- TikTok aceita até 35 fotos; o Instagram, 10 no carrossel. A tela limita por rede.
  ordem smallint not null check (ordem between 0 and 34),
  tipo text not null check (tipo in ('video', 'imagem')),
  -- Caminho no bucket redes-midias: {user_id}/{post_id}/{arquivo}.
  caminho text not null check (char_length(caminho) between 3 and 500),
  mime text not null check (mime in ('video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp')),
  bytes bigint check (bytes is null or bytes > 0),
  largura integer check (largura is null or largura > 0),
  altura integer check (altura is null or altura > 0),
  duracao_s numeric(8, 2) check (duracao_s is null or duracao_s > 0),
  created_at timestamptz not null default now(),
  unique (post_id, ordem)
);
create index if not exists redes_post_midias_user_idx on public.redes_post_midias (user_id);

create table if not exists public.redes_post_destinos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.redes_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rede text not null check (rede in ('tiktok', 'instagram')),
  status text not null default 'pendente'
    check (status in ('pendente', 'publicando', 'publicado', 'erro', 'cancelado')),
  -- Escolhas do TikTok (nulas no Instagram). privacidade sem padrão: a tela só
  -- deixa agendar depois que ela escolhe uma das opções do creator_info.
  tt_privacidade text check (
    tt_privacidade is null
    or tt_privacidade in ('PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY')
  ),
  tt_permite_comentario boolean not null default false,
  tt_permite_dueto boolean not null default false,
  tt_permite_stitch boolean not null default false,
  -- Conteúdo comercial: "divulga marca, produto ou serviço", e qual dos dois.
  tt_divulga_marca boolean not null default false,
  tt_marca_propria boolean not null default false,
  tt_conteudo_de_marca boolean not null default false,
  -- Vale para as duas redes: o post foi feito com IA.
  conteudo_ia boolean not null default false,
  -- Momento em que ela confirmou tudo (consentimento antes de publicar).
  consentiu_em timestamptz,
  publicando_desde timestamptz,
  publicado_em timestamptz,
  -- TikTok: publish_id e depois o id do post; Instagram: id da mídia.
  externo_id text check (externo_id is null or char_length(externo_id) <= 200),
  externo_url text check (externo_url is null or (char_length(externo_url) <= 2000 and externo_url like 'https://%')),
  erro text check (erro is null or char_length(erro) <= 500),
  tentativas smallint not null default 0 check (tentativas between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, rede),
  -- Regra do TikTok: conteúdo de marca não pode ser "só eu".
  check (not tt_conteudo_de_marca or tt_privacidade is distinct from 'SELF_ONLY'),
  -- Divulgou: tem que dizer se é a própria marca, conteúdo de marca, ou os dois.
  check (not tt_divulga_marca or tt_marca_propria or tt_conteudo_de_marca)
);
create index if not exists redes_post_destinos_user_idx on public.redes_post_destinos (user_id);

alter table public.redes_posts enable row level security;
alter table public.redes_post_midias enable row level security;
alter table public.redes_post_destinos enable row level security;
revoke all on public.redes_posts, public.redes_post_midias, public.redes_post_destinos from public, anon, authenticated;
grant select on public.redes_posts, public.redes_post_midias, public.redes_post_destinos to authenticated;
grant all on public.redes_posts, public.redes_post_midias, public.redes_post_destinos to service_role;

drop policy if exists "redes_posts: dona lê" on public.redes_posts;
create policy "redes_posts: dona lê" on public.redes_posts
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "redes_post_midias: dona lê" on public.redes_post_midias;
create policy "redes_post_midias: dona lê" on public.redes_post_midias
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "redes_post_destinos: dona lê" on public.redes_post_destinos;
create policy "redes_post_destinos: dona lê" on public.redes_post_destinos
  for select to authenticated using (user_id = (select auth.uid()));

-- ── 4. bucket das mídias ───────────────────────────────────────────────────
-- Privado: vídeo de cliente não fica em URL pública adivinhável. A rede busca a
-- foto por URL (PULL_FROM_URL no TikTok, image_url no Instagram): isso entra na
-- fase 4 por um endereço do domínio verificado no TikTok, não por este bucket.
-- O navegador sobe direto para a pasta dela ({user_id}/...), sem passar o vídeo
-- pelo Worker. O limite do projeto no Storage pode ser menor que este: conferir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'redes-midias', 'redes-midias', false, 262144000,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "redes-midias: dona sobe" on storage.objects;
create policy "redes-midias: dona sobe" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'redes-midias' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "redes-midias: dona lê" on storage.objects;
create policy "redes-midias: dona lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'redes-midias' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "redes-midias: dona apaga" on storage.objects;
create policy "redes-midias: dona apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'redes-midias' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── 5. renovação dos tokens (cron diário) ──────────────────────────────────
-- Instagram: o token longo vale 60 dias e só se renova antes de vencer. TikTok:
-- o de acesso vale 24 h (renovado na hora de usar); o de renovação, 365 dias, e
-- ganha prazo novo a cada renovação. O cron renova o que vence em até 20 dias
-- (Instagram) ou 30 dias (renovação do TikTok). Edge function redes-token-renovar.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'redes_token_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'redes_token_secret');
  end if;
end $$;

create or replace function public.conferir_segredo_redes_token(p_segredo text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $fn$
  select coalesce(
    (select decrypted_secret = p_segredo from vault.decrypted_secrets where name = 'redes_token_secret'),
    false
  );
$fn$;
revoke all on function public.conferir_segredo_redes_token(text) from public, anon, authenticated;
grant execute on function public.conferir_segredo_redes_token(text) to service_role;

create or replace function public.disparar_redes_token_renovar()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  segredo text;
begin
  if not exists (
       select 1 from redes_conexoes
        where status = 'conectada'
          and (
            (rede = 'instagram' and access_expira_em < now() + interval '20 days'
               and coalesce(renovado_em, created_at) < now() - interval '1 day')
            or (rede = 'tiktok' and refresh_expira_em < now() + interval '30 days')
          )
     ) then
    return;
  end if;
  select decrypted_secret into segredo from vault.decrypted_secrets where name = 'redes_token_secret';
  if segredo is not null then
    perform net.http_post(
      url := 'https://egzwkyqpkexgrhbxwcvb.supabase.co/functions/v1/redes-token-renovar',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-redes-token-secret', segredo)
    );
  end if;
end;
$fn$;
revoke all on function public.disparar_redes_token_renovar() from public, anon, authenticated;

select cron.unschedule('redes-token-renovar')
 where exists (select 1 from cron.job where jobname = 'redes-token-renovar');
-- 07h17 UTC = 04h17 de Brasília.
select cron.schedule('redes-token-renovar', '17 7 * * *', $$select public.disparar_redes_token_renovar()$$);
