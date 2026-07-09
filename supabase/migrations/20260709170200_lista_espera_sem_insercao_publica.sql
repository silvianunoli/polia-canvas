-- SEGURANÇA (abuso/enumeração) — tira o INSERT público da lista de espera.
--
-- Antes, o formulário inseria via cliente anon direto em lista_espera
-- (GRANT INSERT TO anon + policy WITH CHECK (true)). O Turnstile e o honeypot
-- eram checados SÓ no navegador, então um POST direto a /rest/v1/lista_espera
-- com a chave anon pública pulava tudo: dava pra poluir a lista em massa, e o
-- UNIQUE de email virava oráculo de enumeração (erro 23505 confirma e-mail).
--
-- A inscrição passa a entrar pela server function entrarListaEspera
-- (src/lib/lista-espera.functions.ts), que valida o Turnstile no SERVIDOR antes
-- de gravar via service role. Espelha o padrão já aplicado em contatos
-- (migração 20260707220000). Só o service role grava agora.
DROP POLICY IF EXISTS "Lista espera: insercao publica" ON public.lista_espera;
REVOKE INSERT ON public.lista_espera FROM anon, authenticated;
