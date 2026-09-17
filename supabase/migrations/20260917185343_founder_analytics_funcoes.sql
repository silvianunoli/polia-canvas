-- Founder Dashboard, bloco 3: agregações de analytics sobre founder_eventos
-- (sessões, tempo por feature, mapa de calor, coortes de retenção) e a
-- configuração do funil de jornada. Funções SECURITY DEFINER chamadas só pelo
-- service role (polia-admin, server functions); nenhum papel de client executa.
-- Aplicada em produção em 17/09/2026 (version 20260917185343).

create table public.founder_funil_config (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  passos jsonb not null,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);
comment on table public.founder_funil_config is
  'Passos do funil de jornada do Founder Dashboard (/founder/analytics/jornadas). Cada passo: {rotulo, tipo: conta|evento|voltou_7d|recorrente, evento?}. Editável sem deploy.';
alter table public.founder_funil_config enable row level security;
create policy "founder_funil_config: admin gerencia"
  on public.founder_funil_config for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

insert into public.founder_funil_config (nome, passos) values (
  'Padrão',
  '[
    {"rotulo": "Criou conta", "tipo": "conta"},
    {"rotulo": "Completou onboarding", "tipo": "evento", "evento": "onboarding_completed"},
    {"rotulo": "Criou negócio", "tipo": "evento", "evento": "business_created"},
    {"rotulo": "Usou uma funcionalidade", "tipo": "evento", "evento": "feature_completed"},
    {"rotulo": "Voltou em 7 dias", "tipo": "voltou_7d"},
    {"rotulo": "Tornou-se recorrente", "tipo": "recorrente"}
  ]'::jsonb
);

-- Sessão = sessao_id do client; duração = último evento - primeiro (heartbeat
-- a cada 60 s dá precisão de ±1 min); telas = páginas distintas abertas.
create or replace function public.founder_sessoes_calc(p_ini timestamptz, p_fim timestamptz)
returns table (
  sessao_id uuid,
  user_id uuid,
  inicio timestamptz,
  fim timestamptz,
  duracao_s integer,
  telas integer,
  eventos_ativos integer
)
language sql
security definer
set search_path = public
as $$
  select
    e.sessao_id,
    (array_agg(e.user_id) filter (where e.user_id is not null))[1] as user_id,
    min(e.criado_em) as inicio,
    max(e.criado_em) as fim,
    extract(epoch from (max(e.criado_em) - min(e.criado_em)))::integer as duracao_s,
    count(distinct e.pagina) filter (where e.evento = 'feature_opened')::integer as telas,
    count(*) filter (where e.evento in (
      'feature_completed','create_product','edit_product','create_goal','edit_goal',
      'onboarding_completed','business_created'
    ))::integer as eventos_ativos
  from public.founder_eventos e
  where e.criado_em >= p_ini and e.criado_em < p_fim and e.origem = 'client'
  group by e.sessao_id;
$$;
revoke execute on function public.founder_sessoes_calc(timestamptz, timestamptz) from public, anon, authenticated;

-- Tempo por feature: soma dos intervalos entre eventos consecutivos da mesma
-- sessão, atribuído à feature do evento anterior, com teto de 5 min por gap.
create or replace function public.founder_tempo_por_feature(p_ini timestamptz, p_fim timestamptz)
returns table (
  feature text,
  usuarias integer,
  acessos integer,
  concluidos integer,
  tempo_s bigint
)
language sql
security definer
set search_path = public
as $$
  with ev as (
    select
      e.sessao_id, e.user_id, e.feature, e.evento, e.criado_em,
      lead(e.criado_em) over (partition by e.sessao_id order by e.criado_em) as proximo
    from public.founder_eventos e
    where e.criado_em >= p_ini and e.criado_em < p_fim
      and e.origem = 'client' and e.feature is not null
  )
  select
    ev.feature,
    count(distinct ev.user_id)::integer as usuarias,
    count(*) filter (where ev.evento = 'feature_opened')::integer as acessos,
    count(*) filter (where ev.evento = 'feature_completed')::integer as concluidos,
    coalesce(sum(least(extract(epoch from (ev.proximo - ev.criado_em)), 300))
      filter (where ev.proximo is not null), 0)::bigint as tempo_s
  from ev
  group by ev.feature
  order by usuarias desc, acessos desc;
$$;
revoke execute on function public.founder_tempo_por_feature(timestamptz, timestamptz) from public, anon, authenticated;

-- Quando as usuárias usam: dia da semana (0 = domingo) x hora, em horário de Brasília.
create or replace function public.founder_heatmap(p_ini timestamptz, p_fim timestamptz)
returns table (dow integer, hora integer, eventos integer, usuarias integer)
language sql
security definer
set search_path = public
as $$
  select
    extract(dow from (e.criado_em at time zone 'America/Sao_Paulo'))::integer as dow,
    extract(hour from (e.criado_em at time zone 'America/Sao_Paulo'))::integer as hora,
    count(*)::integer as eventos,
    count(distinct e.user_id)::integer as usuarias
  from public.founder_eventos e
  where e.criado_em >= p_ini and e.criado_em < p_fim
    and e.origem = 'client'
    and e.evento not in ('heartbeat', 'sessao_fim')
  group by 1, 2;
$$;
revoke execute on function public.founder_heatmap(timestamptz, timestamptz) from public, anon, authenticated;

-- Retenção por coorte semanal de cadastro: D1/D7/D30 clássicos (janela de 1
-- dia) e "até D7" acumulado, contando só ação real (nunca abrir tela).
create or replace function public.founder_retencao_coortes(p_semanas integer default 8)
returns table (coorte date, tamanho integer, d1 integer, d7 integer, d30 integer, ate_d7 integer)
language sql
security definer
set search_path = public
as $$
  with usuarias as (
    select p.id, p.created_at,
      (date_trunc('week', p.created_at at time zone 'America/Sao_Paulo'))::date as coorte
    from public.profiles p
    where p.created_at >= now() - make_interval(weeks => p_semanas)
  ),
  ativos as (
    select e.user_id, e.criado_em
    from public.founder_eventos e
    where e.user_id is not null and e.evento in (
      'feature_completed','create_product','edit_product','create_goal','edit_goal',
      'onboarding_completed','business_created'
    )
  )
  select
    u.coorte,
    count(*)::integer as tamanho,
    count(*) filter (where exists (
      select 1 from ativos a where a.user_id = u.id
        and a.criado_em >= u.created_at + interval '1 day' and a.criado_em < u.created_at + interval '2 days'
    ))::integer as d1,
    count(*) filter (where exists (
      select 1 from ativos a where a.user_id = u.id
        and a.criado_em >= u.created_at + interval '7 days' and a.criado_em < u.created_at + interval '8 days'
    ))::integer as d7,
    count(*) filter (where exists (
      select 1 from ativos a where a.user_id = u.id
        and a.criado_em >= u.created_at + interval '30 days' and a.criado_em < u.created_at + interval '31 days'
    ))::integer as d30,
    count(*) filter (where exists (
      select 1 from ativos a where a.user_id = u.id
        and a.criado_em >= u.created_at + interval '1 day' and a.criado_em < u.created_at + interval '8 days'
    ))::integer as ate_d7
  from usuarias u
  group by u.coorte
  order by u.coorte;
$$;
revoke execute on function public.founder_retencao_coortes(integer) from public, anon, authenticated;
