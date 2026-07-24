-- Módulo Social da Pólia — Fase 0 (schema).
-- Handoff: handoff-modulo-social-polia.md, Seção 3.
-- Tudo admin-only (deny-all por padrão + policy só pra is_admin). Nenhuma tabela
-- deste módulo é visível pra assinante — é ferramenta interna da Sil.

create type social_tipo as enum ('feed', 'carrossel', 'reel', 'story');
create type social_status as enum (
  'rascunho', 'revisado', 'aprovado', 'agendado',
  'publicando', 'publicado', 'falhou', 'cancelado'
);

create table social_posts (
  id uuid primary key default gen_random_uuid(),
  tipo social_tipo not null,
  pilar text check (pilar in ('P1', 'P2', 'P3', 'P4', 'P5')),
  gancho text not null,
  caption text not null,
  alt_text text[],
  midias text[] not null,
  scheduled_at timestamptz,
  status social_status not null default 'rascunho',
  erro text,
  ig_media_id text,
  permalink text,
  aprovado_por uuid references auth.users(id),
  aprovado_em timestamptz,
  versoes jsonb not null default '[]',
  slides jsonb,
  created_at timestamptz not null default now()
);

create table social_pauta (
  id uuid primary key default gen_random_uuid(),
  semana date not null,
  dia date not null,
  pilar text check (pilar in ('P1', 'P2', 'P3', 'P4', 'P5')),
  formato social_tipo not null,
  gancho text not null,
  estrutura text,
  cta text not null,
  status text not null default 'sugerida'
    check (status in ('sugerida', 'aceita', 'descartada', 'produzida')),
  post_id uuid references social_posts(id)
);

create table social_geracoes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references social_posts(id),
  acao text check (acao in ('pauta', 'copy', 'revisao', 'ajuste', 'imagem')),
  modelo text,
  tokens_in int,
  tokens_out int,
  veredito_revisora text,
  criado_em timestamptz not null default now()
);

create table dm_gatilhos (
  id uuid primary key default gen_random_uuid(),
  palavra text not null,
  post_ig_id text,
  resposta text not null,
  ativo boolean not null default true,
  max_por_dia int not null default 200,
  created_at timestamptz not null default now()
);

create table dm_conversas (
  id uuid primary key default gen_random_uuid(),
  ig_user_id text not null,
  comment_id text unique,
  gatilho_id uuid references dm_gatilhos(id),
  estado text not null default 'respondido'
    check (estado in ('respondido', 'janela_aberta', 'encerrado', 'optout')),
  ultima_msg_em timestamptz,
  log jsonb not null default '[]'
);

create table social_metricas (
  post_id uuid not null references social_posts(id),
  dia date not null,
  reach int,
  saves int,
  shares int,
  comments int,
  likes int,
  follows int,
  primary key (post_id, dia)
);

-- RLS: deny-all por padrão (nenhuma policy = ninguém acessa), só admin entra.
alter table social_posts enable row level security;
alter table social_pauta enable row level security;
alter table social_geracoes enable row level security;
alter table dm_gatilhos enable row level security;
alter table dm_conversas enable row level security;
alter table social_metricas enable row level security;

create policy "Social posts: admin"
  on social_posts for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "Social pauta: admin"
  on social_pauta for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "Social geracoes: admin"
  on social_geracoes for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "DM gatilhos: admin"
  on dm_gatilhos for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "DM conversas: admin"
  on dm_conversas for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "Social metricas: admin"
  on social_metricas for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

comment on table social_posts is 'Posts do Instagram @usepolia: rascunho até publicado. Ferramenta interna, sem acesso de assinante.';
comment on table dm_gatilhos is 'Palavras-gatilho que disparam private reply em comentários do IG. Resposta passa pelo lint R1 antes de salvar.';
comment on table dm_conversas is 'Uma linha por comentário respondido (comment_id é unique — garante 1 private reply por comentário, mesmo com retry de webhook).';

-- Bucket público pra mídia publicada (feed/carrossel/reel/story). Upload só por admin;
-- leitura pública é via getPublicUrl (não passa por RLS), então a policy de SELECT aqui
-- é só pra listagem via API — segue o padrão já usado em blog-media.
insert into storage.buckets (id, name, public)
values ('social', 'social', true)
on conflict (id) do nothing;

create policy "Social media: admin gerencia"
  on storage.objects for all
  using (bucket_id = 'social' and public.is_admin(auth.uid()))
  with check (bucket_id = 'social' and public.is_admin(auth.uid()));
