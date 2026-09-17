-- founder_alertas.resolvido_por apontava pra auth.users sem ON DELETE: apagar a
-- conta de uma admin que já resolveu um alerta travava o DELETE em auth.users
-- ("Database error deleting user", etapa 3 da exclusão de conta). O alerta
-- fica, a autoria some — mesmo critério de admin_audit_log.admin_id.
-- Aplicada em produção em 17/09/2026 (version 20260917181121).
alter table public.founder_alertas
  drop constraint if exists founder_alertas_resolvido_por_fkey;
alter table public.founder_alertas
  add constraint founder_alertas_resolvido_por_fkey
  foreign key (resolvido_por) references auth.users(id) on delete set null;
