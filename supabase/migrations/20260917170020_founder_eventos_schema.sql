-- Founder Dashboard, bloco 2: instrumentação própria de eventos (seção 8 do
-- direcionamento). Eventos de produto por usuária/sessão, eventos de sistema
-- (falhas de API/job/integração/IA, latência) e medição das chamadas da API
-- (server functions e SSR) do polia-app. Independente de eventos_analytics.
-- Aplicada em produção em 17/09/2026 (version 20260917170020).

create table public.founder_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  sessao_id uuid not null,
  evento text not null check (evento = any (array[
    'signup','login','logout',
    'onboarding_started','onboarding_completed','business_created',
    'feature_opened','feature_completed',
    'create_product','edit_product','create_goal','edit_goal',
    'subscription_started','subscription_cancelled','payment_failed',
    'heartbeat','sessao_fim'
  ])),
  feature text,
  pagina text,
  ambiente text not null default 'prod' check (ambiente in ('prod','preview','dev')),
  origem text not null default 'client' check (origem in ('client','server','webhook')),
  propriedades jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index founder_eventos_criado_idx on public.founder_eventos (criado_em desc);
create index founder_eventos_user_idx on public.founder_eventos (user_id, criado_em desc);
create index founder_eventos_sessao_idx on public.founder_eventos (sessao_id, criado_em);
create index founder_eventos_evento_idx on public.founder_eventos (evento, criado_em desc);
create index founder_eventos_feature_idx on public.founder_eventos (feature, criado_em desc)
  where feature is not null;

comment on table public.founder_eventos is
  'Eventos de produto do Founder Dashboard (signup, login, feature_opened, create_product...). Gravados pelo polia-app (src/lib/founder-eventos.ts no client, founder-eventos.server.ts no servidor, stripe-webhook). Usuária logada grava sempre (dado operacional do serviço, sem IP/UA/geo) — decisão de 17/09/2026, ver docs/adr/0001. Retenção 180 dias.';

alter table public.founder_eventos enable row level security;
create policy "founder_eventos: insere com user_id proprio ou nulo"
  on public.founder_eventos for insert
  to anon, authenticated
  with check ((auth.uid() is null and user_id is null) or auth.uid() = user_id);
create policy "founder_eventos: leitura admin"
  on public.founder_eventos for select
  to authenticated
  using (is_admin(auth.uid()));

create table public.founder_eventos_sistema (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'api_error','job_failure','integration_failure','latency','ia_call','ia_failure','webhook_failure'
  )),
  origem text not null,
  servico text,
  detalhes jsonb not null default '{}'::jsonb,
  latencia_ms integer,
  criado_em timestamptz not null default now()
);
create index founder_eventos_sistema_tipo_idx on public.founder_eventos_sistema (tipo, criado_em desc);

comment on table public.founder_eventos_sistema is
  'Eventos de sistema do Founder Dashboard: erro de API, falha de job/integração/webhook, chamada e falha de IA (com latência). Escrita só por service role (Worker e Edge Functions).';

alter table public.founder_eventos_sistema enable row level security;
create policy "founder_eventos_sistema: leitura admin"
  on public.founder_eventos_sistema for select
  to authenticated
  using (is_admin(auth.uid()));

create table public.founder_api_chamadas (
  id bigint generated always as identity primary key,
  fn text not null,
  tipo text not null check (tipo in ('server_fn','ssr')),
  metodo text,
  ok boolean not null,
  status integer,
  latencia_ms integer not null,
  user_id uuid,
  criado_em timestamptz not null default now()
);
create index founder_api_chamadas_criado_idx on public.founder_api_chamadas (criado_em desc);
create index founder_api_chamadas_fn_idx on public.founder_api_chamadas (fn, criado_em desc);

comment on table public.founder_api_chamadas is
  'Uma linha por chamada de server function (e amostra de SSR) do polia-app, medida pelo middleware global em src/start.ts. Base de requests, taxa de erro, p95/p99 em /founder/infra/api. user_id sem FK de propósito (telemetria); a exclusão de conta apaga pela varredura de user_id.';

alter table public.founder_api_chamadas enable row level security;
create policy "founder_api_chamadas: leitura admin"
  on public.founder_api_chamadas for select
  to authenticated
  using (is_admin(auth.uid()));

create table public.founder_features (
  key text primary key,
  nome text not null,
  rota_prefixo text not null,
  grupo text not null,
  ativa boolean not null default true
);
comment on table public.founder_features is
  'Catálogo de funcionalidades do produto (rota -> feature). Rótulos do /founder e base do "features quase sem uso"; o polia-app carrega o mesmo mapa em src/lib/founder-features.ts.';

alter table public.founder_features enable row level security;
create policy "founder_features: leitura publica"
  on public.founder_features for select
  to anon, authenticated
  using (true);
create policy "founder_features: admin gerencia"
  on public.founder_features for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

insert into public.founder_features (key, nome, rota_prefixo, grupo) values
  ('painel', 'Painel', '/painel', 'nucleo'),
  ('planejamento', 'Planejamento', '/planejamento', 'nucleo'),
  ('produtos', 'Produtos', '/produtos', 'dinheiro'),
  ('projecao', 'Projeção', '/projecao', 'dinheiro'),
  ('financeiro', 'Financeiro', '/financeiro', 'dinheiro'),
  ('raiox', 'Raio-X', '/raiox', 'dinheiro'),
  ('clientes', 'Clientes', '/clientes', 'operacao'),
  ('metas', 'Metas', '/metas', 'operacao'),
  ('caderno', 'Caderno', '/caderno', 'operacao'),
  ('planner', 'Planner', '/planner', 'operacao'),
  ('plano_conteudo', 'Plano de conteúdo', '/plano-conteudo', 'marca'),
  ('calendario', 'Calendário', '/calendario', 'operacao'),
  ('aimer', 'Aimer', '/aimer', 'ia'),
  ('marca', 'Marca', '/marca', 'marca'),
  ('mercado', 'Mercado', '/mercado', 'marca'),
  ('configuracoes', 'Configurações', '/configuracoes', 'conta'),
  ('chamados', 'Chamados', '/chamados', 'conta'),
  ('assinar', 'Assinar', '/assinar', 'conta'),
  ('upgrade', 'Upgrade', '/upgrade', 'conta'),
  ('onboarding', 'Onboarding', '/onboarding', 'conta');
