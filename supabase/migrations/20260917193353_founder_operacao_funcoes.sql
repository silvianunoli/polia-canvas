-- Founder Dashboard, bloco 6: leituras de infraestrutura que não saem pelo
-- PostgREST (cron, pg_stat_*, storage) como funções SECURITY DEFINER só pro
-- service role, e a tabela de releases (registro manual do que subiu).
-- Espelho do que foi aplicado via MCP em 17/09/2026 (versão 20260917193353).

create or replace function public.founder_jobs_status(p_horas integer default 24)
returns table (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  executados integer,
  falhos integer,
  pendentes integer,
  duracao_media_s numeric,
  duracao_max_s numeric,
  ultima_execucao timestamptz,
  ultimo_status text,
  ultimo_erro text
)
language sql
security definer
set search_path = public
as $$
  with runs as (
    select r.jobid, r.status, r.start_time, r.end_time, r.return_message
    from cron.job_run_details r
    where r.start_time > now() - make_interval(hours => p_horas)
  ),
  ultimo as (
    select distinct on (r.jobid) r.jobid, r.status, r.return_message, r.start_time
    from cron.job_run_details r
    order by r.jobid, r.start_time desc
  )
  select
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    count(runs.jobid)::integer as executados,
    count(runs.jobid) filter (where runs.status = 'failed')::integer as falhos,
    count(runs.jobid) filter (where runs.status in ('starting', 'running'))::integer as pendentes,
    round(avg(extract(epoch from (runs.end_time - runs.start_time)))::numeric, 2) as duracao_media_s,
    round(max(extract(epoch from (runs.end_time - runs.start_time)))::numeric, 2) as duracao_max_s,
    u.start_time as ultima_execucao,
    u.status::text as ultimo_status,
    case when u.status = 'failed' then left(u.return_message, 300) else null end as ultimo_erro
  from cron.job j
  left join runs on runs.jobid = j.jobid
  left join ultimo u on u.jobid = j.jobid
  group by j.jobid, j.jobname, j.schedule, j.active, u.start_time, u.status, u.return_message
  order by j.jobname;
$$;
revoke execute on function public.founder_jobs_status(integer) from public, anon, authenticated;

create or replace function public.founder_banco_status()
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'tamanho_bytes', pg_database_size(current_database()),
    'conexoes', (
      select jsonb_object_agg(coalesce(state, 'desconhecido'), n)
      from (select state, count(*) as n from pg_stat_activity where datname = current_database() group by state) s
    ),
    'conexoes_total', (select count(*) from pg_stat_activity where datname = current_database()),
    'tabelas', (
      select jsonb_agg(jsonb_build_object('tabela', relname, 'bytes', bytes, 'linhas', linhas) order by bytes desc)
      from (
        select c.relname, pg_total_relation_size(c.oid) as bytes, c.reltuples::bigint as linhas
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc limit 12
      ) t
    ),
    'lentas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'consulta', left(query, 140), 'chamadas', calls,
        'media_ms', round(mean_exec_time::numeric, 1), 'total_ms', round(total_exec_time::numeric, 0)
      ) order by mean_exec_time desc), '[]'::jsonb)
      from (
        select query, calls, mean_exec_time, total_exec_time
        from extensions.pg_stat_statements
        where calls > 20 and query not ilike '%pg_stat_statements%'
        order by mean_exec_time desc limit 10
      ) q
    )
  );
$$;
revoke execute on function public.founder_banco_status() from public, anon, authenticated;

create or replace function public.founder_storage_status(p_dias integer default 30)
returns table (bucket text, publico boolean, objetos bigint, bytes numeric, novos_no_periodo bigint)
language sql
security definer
set search_path = public
as $$
  select
    b.name::text as bucket,
    b.public as publico,
    count(o.id) as objetos,
    coalesce(sum((o.metadata->>'size')::numeric), 0) as bytes,
    count(o.id) filter (where o.created_at > now() - make_interval(days => p_dias)) as novos_no_periodo
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  group by b.name, b.public
  order by bytes desc;
$$;
revoke execute on function public.founder_storage_status(integer) from public, anon, authenticated;

create table public.founder_releases (
  id uuid primary key default gen_random_uuid(),
  repositorio text not null check (repositorio in ('polia-app', 'polia-admin', 'polia-servicos', 'polia-comunidade', 'supabase')),
  versao text,
  titulo text not null,
  descricao text,
  commit_sha text,
  flags jsonb not null default '[]'::jsonb,
  deployado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);
comment on table public.founder_releases is
  'Registro do que subiu pra produção (por repositório), preenchido à mão em /founder/features/releases. Serve pra cruzar "quando mudou" com os gráficos de uso e erro.';
alter table public.founder_releases enable row level security;
create policy "founder_releases: admin gerencia"
  on public.founder_releases for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));
