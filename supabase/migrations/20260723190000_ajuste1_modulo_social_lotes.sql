-- Módulo Social — Ajuste 1 (aditivo ao handoff base).
-- Handoff: handoff-modulo-social-polia-ajuste-1.md, Seção 1.
-- Fluxo "Criar" (único/massa), diretrizes por upload, legenda opcional por IA.

create table social_lotes (
  id uuid primary key default gen_random_uuid(),
  tipo social_tipo not null,
  modo text not null check (modo in ('unico', 'massa')),
  origem text not null check (origem in ('tema', 'backlog', 'pauta')),
  tema text,
  quantidade int not null check (quantidade between 1 and 30),
  custo_estimado_tokens int,
  status text not null default 'gerando'
    check (status in ('gerando', 'pronto', 'parcial', 'falhou')),
  criado_em timestamptz not null default now()
);

alter table social_posts add column lote_id uuid references social_lotes(id);
alter table social_posts add column legenda_por_ia boolean not null default true;

create table diretrizes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('design', 'voz')),
  nome_arquivo text not null,
  conteudo text not null,
  ativo boolean not null default false,
  criado_em timestamptz not null default now()
);

-- No máximo 1 diretriz ativa por tipo (design e voz cada uma com a sua).
create unique index diretrizes_ativa_unica on diretrizes(tipo) where ativo;

alter table social_lotes enable row level security;
alter table diretrizes enable row level security;

create policy "Social lotes: admin"
  on social_lotes for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "Diretrizes: admin"
  on diretrizes for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

comment on table social_lotes is 'Lote de produção em massa (Criar > em massa). Cada peça gerada aponta pra cá via social_posts.lote_id.';
comment on table diretrizes is 'Diretriz de design/voz por upload, SUBORDINADA aos guardrails do repo (R12) — nunca revoga o lint R1 nem altera tokens do DESIGN-3 (R16).';
