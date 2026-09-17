-- Schema do Founder Dashboard (polia-admin, rota /founder, commit 9a3a97b).
--
-- Este arquivo foi RECONSTRUÍDO em 17/09/2026 a partir do schema já aplicado em
-- produção (version 20260917144229 em supabase_migrations.schema_migrations).
-- A migração original foi aplicada direto (fora do fluxo de arquivo versionado)
-- e nunca chegou a existir como .sql em nenhum repo -- mesma classe de drift do
-- HIG-02 (migrations de 09/09 sem commit), só que dessa vez sem nenhum arquivo
-- em lugar nenhum, não só sem commit. Reconstrução fiel via information_schema
-- + pg_constraint + pg_policies do banco real, comentários originais mantidos.

create table if not exists public.founder_alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  severidade text not null check (severidade = any (array['atencao', 'critico'])),
  titulo text not null,
  mensagem text,
  detalhes jsonb not null default '{}'::jsonb,
  link text,
  status text not null default 'aberto' check (status = any (array['aberto', 'resolvido'])),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references auth.users(id)
);

comment on table public.founder_alertas is
  'Motor de alertas próprio do Founder Dashboard (separado de alertas_abertos, que é do motor antigo baseado em alerta_regras). Avaliado a cada carregamento/refresh de /founder, comparando com founder_metricas_diarias.';

create index if not exists founder_alertas_status_idx
  on public.founder_alertas using btree (status, criado_em desc);

alter table public.founder_alertas enable row level security;

create policy "founder_alertas: admin gerencia" on public.founder_alertas
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

create table if not exists public.founder_metricas_diarias (
  dia date primary key,
  usuarias_total integer not null,
  novas_contas integer not null,
  usuarias_ativas integer not null,
  assinantes integer not null,
  mrr_centavos bigint not null,
  churn_pct numeric,
  erros_dia integer not null,
  calculado_em timestamptz not null default now()
);

comment on table public.founder_metricas_diarias is
  'Snapshot diário (upsert por dia) dos números principais do Founder Dashboard. Base de comparação pro Founder Pulse ("cresceu X% essa semana") e pra detecção de anomalia dos alertas. "usuarias_ativas" = profiles.updated_at dentro do dia (proxy honesto — sem instrumentação de evento própria ainda, fase 2 do direcionamento).';

alter table public.founder_metricas_diarias enable row level security;

create policy "founder_metricas_diarias: leitura admin" on public.founder_metricas_diarias
  for select to authenticated
  using (is_admin(auth.uid()));

create table if not exists public.founder_service_checks (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null
    check (status = any (array['operacional', 'atencao', 'critico', 'sem_dados'])),
  detalhe text,
  latencia_ms integer,
  checado_em timestamptz not null default now()
);

comment on table public.founder_service_checks is
  'Histórico de health-checks do Founder Dashboard (API, banco, auth, pagamentos, storage etc). Rodado ao vivo quando a página /founder carrega ou no refresh manual — sem cron ainda. Escrita só via service role (getFounderOverview).';

create index if not exists founder_service_checks_service_checado_idx
  on public.founder_service_checks using btree (service, checado_em desc);

alter table public.founder_service_checks enable row level security;

create policy "founder_service_checks: leitura admin" on public.founder_service_checks
  for select to authenticated
  using (is_admin(auth.uid()));
