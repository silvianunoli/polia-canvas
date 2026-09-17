-- Founder Dashboard, bloco 5: experimentos amarrados a uma feature flag.
-- A variante da usuária é o lado da flag (dentro do rollout/beta = "com",
-- fora = "sem"); a métrica é um evento de founder_eventos contado por usuária
-- desde o início do experimento. Sem motor de A/B próprio: a flag já divide.
-- Aplicada em produção em 17/09/2026 (version 20260917192140).

create table public.founder_experimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  hipotese text,
  flag_key text not null,
  metrica_evento text not null,
  metrica_feature text,
  inicio timestamptz not null default now(),
  fim timestamptz,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'concluido')),
  resultado text,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);
comment on table public.founder_experimentos is
  'Experimentos do Founder Dashboard: cada um aponta pra uma flag (founder_flags) e pra um evento-métrica. Resultados calculados na hora em /founder/produto/experimentos comparando quem cai dentro x fora do rollout da flag.';

alter table public.founder_experimentos enable row level security;
create policy "founder_experimentos: admin gerencia"
  on public.founder_experimentos for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));
