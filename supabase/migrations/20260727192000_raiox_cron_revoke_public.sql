-- disparar_raiox_mensal() só deve rodar via pg_cron, nunca via RPC direto por
-- qualquer usuária. Diferente das correções anteriores (20260727170000), esta
-- função nunca teve NENHUM revoke — o projeto Supabase tem `ALTER DEFAULT
-- PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated` configurado,
-- então toda função nova já nasce com grant EXPLÍCITO pras duas (não só via
-- PUBLIC) — confirmado via `proacl` mostrando `anon=X`/`authenticated=X`
-- individualmente. Por isso revoga as duas E public, sempre as três juntas.
revoke execute on function public.disparar_raiox_mensal() from anon, authenticated, public;
