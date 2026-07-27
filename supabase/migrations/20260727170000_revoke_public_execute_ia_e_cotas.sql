-- Correção de segurança: `revoke execute ... from anon, authenticated` não
-- basta pra bloquear essas roles via RPC. Funções novas recebem EXECUTE pra
-- PUBLIC por padrão no Postgres, e tanto anon quanto authenticated herdam
-- esse privilégio por PUBLIC independente de um revoke direcionado só a elas.
-- Confirmado via has_function_privilege(): as 3 funções abaixo continuavam
-- executáveis por anon/authenticated mesmo depois do revoke anterior
-- (20260727130000, 20260727160000). service_role (usado pelo servidor) não é
-- afetado — ele tem grant próprio, não herda de PUBLIC.
revoke execute on function public.assert_cota_confere() from public;
revoke execute on function public.incrementar_ia_uso(uuid, text, text, int) from public;
revoke execute on function public.estornar_ia_uso(uuid, text, text) from public;
