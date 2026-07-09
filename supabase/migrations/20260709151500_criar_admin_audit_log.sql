-- Retroativa: tabela já existia em produção (criada em sessão anterior sem
-- migração versionada). Documentada aqui pra bater com o estado real do banco
-- antes de convites.functions.ts passar a depender dela (logAcaoAdminServer).
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete set null,
  acao text not null,
  alvo text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log: admin insere a propria acao"
  on public.admin_audit_log
  for insert
  to authenticated
  with check (admin_id = auth.uid() and public.is_admin(auth.uid()));

create policy "admin_audit_log: leitura so admin"
  on public.admin_audit_log
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
