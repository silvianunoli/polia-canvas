-- CRM-11 (07/10/2026): a conta de teste oi.prismia@gmail.com nasce com acesso
-- total pelo convite (plano beta, "Lançamento" em /crm/convites), pelo caminho
-- normal desde o CRM-09. O gatilho temporário de 17/09 tinha o e-mail escrito
-- dentro da função e sai junto com ela. Aplicada no banco via MCP em 07/10.
update public.convites_cadastro set plano = 'beta' where lower(email) = 'oi.prismia@gmail.com';
drop trigger if exists tmp_plano_beta_conta_teste on public.profiles;
drop function if exists public.tmp_plano_beta_conta_teste();
