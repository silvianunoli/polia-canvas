-- checar_taxa_erro_e_alertar() e checar_uptimerobot_e_alertar() são SECURITY
-- DEFINER e só deveriam rodar via pg_cron. Sem essa revogação, qualquer
-- requisição (mesmo anônima) podia chamá-las via /rest/v1/rpc/.
REVOKE EXECUTE ON FUNCTION public.checar_taxa_erro_e_alertar()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.checar_uptimerobot_e_alertar() FROM PUBLIC, anon, authenticated;
