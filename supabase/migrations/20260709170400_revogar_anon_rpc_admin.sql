-- SEGURANÇA (menor privilégio) — tira o EXECUTE de anon nas RPCs admin.
--
-- admin_limpar_logs_antigos() e admin_tamanhos_tabelas() já se protegem por
-- dentro (checam is_admin(auth.uid()) antes de agir), então NÃO eram
-- exploráveis. Mas o EXECUTE herdado de PUBLIC deixava o anon poder chamá-las
-- via /rest/v1/rpc/ sem login — o linter de segurança do Supabase sinaliza isso.
-- Removemos o grant a anon/PUBLIC e devolvemos só a authenticated, que é como o
-- app chama essas RPCs (pela sessão da admin em /admin/governanca).
REVOKE EXECUTE ON FUNCTION public.admin_limpar_logs_antigos() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_limpar_logs_antigos() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_tamanhos_tabelas() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_tamanhos_tabelas() TO authenticated;
