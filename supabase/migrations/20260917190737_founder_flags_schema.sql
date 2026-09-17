-- Founder Dashboard, bloco 4: feature flags com estado (on/off/beta), ambiente,
-- rollout gradual e histórico de alterações (seção 3.5 do direcionamento).
-- Substitui feature_flags como fonte do app (os leitores migram no polia-app);
-- a tabela antiga fica intocada por enquanto e cai numa migration própria.
-- Aplicada em produção em 17/09/2026 (version 20260917190737).

create table public.founder_flags (
  key text not null,
  ambiente text not null default 'prod' check (ambiente in ('prod', 'preview')),
  nome text not null,
  descricao text,
  estado text not null default 'off' check (estado in ('on', 'off', 'beta')),
  rollout_pct integer not null default 100 check (rollout_pct between 0 and 100),
  beta_user_ids uuid[] not null default '{}',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  primary key (key, ambiente)
);
comment on table public.founder_flags is
  'Feature flags do Founder Dashboard. estado on = liga pra rollout_pct% das usuárias (bucket determinístico por sha256(user_id:key)); beta = só beta_user_ids + rollout_pct%; off = ninguém. Uma linha por ambiente (prod/preview). Lida pelo polia-app em src/lib/flags.ts / flags.server.ts.';

alter table public.founder_flags enable row level security;
create policy "founder_flags: leitura publica"
  on public.founder_flags for select
  to anon, authenticated
  using (true);
create policy "founder_flags: admin gerencia"
  on public.founder_flags for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

create table public.founder_flags_historico (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null,
  ambiente text not null,
  alterado_por uuid,
  alterado_em timestamptz not null default now(),
  estado_anterior jsonb,
  estado_novo jsonb not null,
  motivo text
);
create index founder_flags_historico_flag_idx
  on public.founder_flags_historico (flag_key, ambiente, alterado_em desc);
comment on table public.founder_flags_historico is
  'Trilha de toda mudança em founder_flags (quem, quando, estado anterior e novo), gravada por trigger. Sem UPDATE/DELETE pelo client.';

alter table public.founder_flags_historico enable row level security;
create policy "founder_flags_historico: leitura admin"
  on public.founder_flags_historico for select
  to authenticated
  using (is_admin(auth.uid()));

create or replace function public.founder_flags_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.founder_flags_historico (flag_key, ambiente, alterado_por, estado_anterior, estado_novo)
  values (
    new.key,
    new.ambiente,
    coalesce(new.atualizado_por, auth.uid()),
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'estado', old.estado, 'rollout_pct', old.rollout_pct, 'beta_user_ids', old.beta_user_ids,
      'nome', old.nome, 'descricao', old.descricao
    ) else null end,
    jsonb_build_object(
      'estado', new.estado, 'rollout_pct', new.rollout_pct, 'beta_user_ids', new.beta_user_ids,
      'nome', new.nome, 'descricao', new.descricao
    )
  );
  return new;
end;
$$;

create trigger founder_flags_historico_trg
  after insert or update on public.founder_flags
  for each row execute function public.founder_flags_registrar_historico();

-- Seed a partir das flags antigas, nos dois ambientes, com o mesmo estado.
insert into public.founder_flags (key, ambiente, nome, descricao, estado, rollout_pct)
select f.key, a.ambiente, f.key, f.description,
       case when f.enabled then 'on' else 'off' end, 100
from public.feature_flags f
cross join (values ('prod'), ('preview')) as a(ambiente);
