-- Descadastro de um clique no e-mail do quiz.
--
-- O consentimento diz "você sai quando quiser". Até aqui a saída era escrever
-- pra oi@usepolia.com.br, o que é saída no papel, não na prática. Estas duas
-- colunas sustentam um link direto no rodapé do e-mail.
--
-- O token é uuid aleatório e vive só no link: assim o endereço de e-mail nunca
-- aparece na URL (nem no histórico do navegador, nem em log de servidor, nem no
-- referer), e ninguém descadastra a lista dos outros chutando parâmetro.
--
-- Descadastro MARCA, não apaga: apagar a linha faria a pessoa sumir da
-- supressão e voltar a receber na próxima importação. A linha fica, com a data.

ALTER TABLE public.quiz_leads
  ADD COLUMN descadastro_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN descadastrado_em timestamptz;

-- Único porque é a chave de busca do link, e o índice é o que torna a busca
-- por token barata.
CREATE UNIQUE INDEX quiz_leads_descadastro_token_key
  ON public.quiz_leads (descadastro_token);

COMMENT ON COLUMN public.quiz_leads.descadastro_token IS
  'Segredo do link de descadastro (/descadastrar?t=...). Nunca expor em lista '
  'nem em tela: quem tem o token descadastra a linha.';

COMMENT ON COLUMN public.quiz_leads.descadastrado_em IS
  'Preenchido quando a pessoa pede pra sair. Enquanto tiver data aqui, nenhum '
  'envio novo deve incluir esta linha. Refazer o quiz com o consentimento '
  'marcado limpa o campo, porque é consentimento novo e explícito.';
