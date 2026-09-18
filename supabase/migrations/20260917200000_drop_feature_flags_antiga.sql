-- Founder Dashboard, bloco 4 (fechamento): a tabela antiga feature_flags foi
-- substituída por founder_flags em 17/09/2026. Todos os leitores do app e o
-- cron raiox-mensal já leem da nova; as 5 flags foram migradas (prod e
-- preview) na migration 20260917190737. A Sil confirmou o drop no mesmo dia
-- e rodou este comando à mão no SQL Editor (o assistente não tem permissão
-- pra drop em produção), por isso a versão não aparece em schema_migrations.
drop table if exists public.feature_flags;
