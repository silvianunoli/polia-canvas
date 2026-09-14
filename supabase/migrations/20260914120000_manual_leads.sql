-- Leads do "Manual da Pequena Marca que Quer Ser Grande" (isca gratuita, rota
-- /manual). Guarda quem pediu o PDF pelo gate de e-mail e sustenta dois links
-- que saem no e-mail de entrega: o de download e o de descadastro.
--
-- Tabela separada de quiz_leads de propósito: são duas iscas com promessas
-- diferentes (diagnóstico x PDF) e a Sil precisa saber de qual delas cada
-- e-mail veio. Cruzar as duas é um SELECT, juntar é perder essa informação.
--
-- Segurança: mesma postura de quiz_leads (20260811215137). RLS ligado com
-- policy deny-all explícita e escrita SOMENTE via service role, na server
-- function src/lib/manual.functions.ts. Sem leitura pública: é base de e-mails.

CREATE TABLE public.manual_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  origem text NOT NULL DEFAULT 'instagram_bio',
  consentimento boolean NOT NULL,
  consent_texto text,
  download_token uuid NOT NULL DEFAULT gen_random_uuid(),
  descadastro_token uuid NOT NULL DEFAULT gen_random_uuid(),
  descadastrado_em timestamptz,
  baixado_em timestamptz,
  downloads integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE public.manual_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manual leads: sem acesso via cliente"
  ON public.manual_leads
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Os dois tokens são chave de busca de link: únicos, e o índice é o que torna
-- a busca barata.
CREATE UNIQUE INDEX manual_leads_download_token_key
  ON public.manual_leads (download_token);
CREATE UNIQUE INDEX manual_leads_descadastro_token_key
  ON public.manual_leads (descadastro_token);

COMMENT ON TABLE public.manual_leads IS
  'Leads do manual gratuito /manual (isca do pré-lançamento). Uma linha por e-mail: '
  'pedir de novo com o mesmo e-mail ATUALIZA a linha (upsert por email), nunca duplica. '
  'Acesso SOMENTE via service role em src/lib/manual.functions.ts.';

COMMENT ON COLUMN public.manual_leads.email IS
  'Normalizado no servidor: trim + minúsculas. UNIQUE é a chave do upsert.';

COMMENT ON COLUMN public.manual_leads.consent_texto IS
  'Frase de consentimento exatamente como foi exibida na tela, pra auditoria LGPD.';

COMMENT ON COLUMN public.manual_leads.download_token IS
  'Segredo do link de download (/manual/baixar?t=...). O PDF não fica exposto em URL '
  'pública: o Worker só entrega o arquivo pra quem apresenta um token que existe aqui.';

COMMENT ON COLUMN public.manual_leads.descadastro_token IS
  'Segredo do link de descadastro (/descadastrar?t=...). Nunca expor em lista nem em tela.';

COMMENT ON COLUMN public.manual_leads.descadastrado_em IS
  'Preenchido quando a pessoa pede pra sair. Enquanto tiver data aqui, nenhum envio novo '
  'deve incluir esta linha. Pedir o manual de novo com o consentimento marcado limpa o campo.';

COMMENT ON COLUMN public.manual_leads.baixado_em IS
  'Última vez que o PDF foi entregue pelo link. Nulo = pediu e nunca baixou.';

COMMENT ON COLUMN public.manual_leads.downloads IS
  'Quantas vezes o link de download entregou o arquivo. É métrica, não trava: o link '
  'continua valendo depois do primeiro uso, porque a pessoa pode trocar de aparelho.';
