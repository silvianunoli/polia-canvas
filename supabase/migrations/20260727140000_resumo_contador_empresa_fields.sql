-- Campos de empresa pro cabeçalho do "Resumo do mês pro contador" (Projete).
-- Sem CHECK de formato de CNPJ: é campo informativo pro cabeçalho do relatório,
-- não documento fiscal validado. Sem mudança de RLS — já cobertos pela policy
-- existente de update da própria usuária (não são plano/is_admin, não estão
-- congelados pela migração 20260709170000).
alter table public.profiles add column if not exists razao_social text;
alter table public.profiles add column if not exists cnpj text;
