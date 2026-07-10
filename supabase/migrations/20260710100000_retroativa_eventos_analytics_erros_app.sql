-- Retroativa: eventos_analytics e erros_app já existiam em produção (criadas
-- em sessão anterior sem migração versionada, junto com src/lib/analytics.ts
-- e src/lib/error-log.ts / error-capture.ts). Documentada aqui pra bater com
-- o estado real do banco antes da Fase 1 do plano de tagueamento.

create table public.eventos_analytics (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  pagina text not null,
  sessao_id text not null,
  user_id uuid references public.profiles(id) on delete set null,
  propriedades jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index idx_eventos_analytics_criado_em on public.eventos_analytics using btree (criado_em desc);
create index idx_eventos_analytics_pagina on public.eventos_analytics using btree (pagina);
create index idx_eventos_analytics_evento on public.eventos_analytics using btree (evento);
create index idx_eventos_analytics_sessao on public.eventos_analytics using btree (sessao_id);

alter table public.eventos_analytics enable row level security;

create policy "eventos_analytics: insere com user_id proprio ou nulo"
  on public.eventos_analytics
  for insert
  to anon, authenticated
  with check ((auth.uid() is null and user_id is null) or auth.uid() = user_id);

create policy "eventos_analytics: leitura so admin"
  on public.eventos_analytics
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create table public.erros_app (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  mensagem text not null,
  stack text,
  pagina text,
  contexto jsonb not null default '{}'::jsonb,
  user_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index idx_erros_app_criado_em on public.erros_app using btree (criado_em desc);
create index idx_erros_app_origem on public.erros_app using btree (origem);

alter table public.erros_app enable row level security;

create policy "erros_app: insere com user_id proprio ou nulo"
  on public.erros_app
  for insert
  to anon, authenticated
  with check ((auth.uid() is null and user_id is null) or auth.uid() = user_id);

create policy "erros_app: leitura so admin"
  on public.erros_app
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
