-- Quiz "Você está pagando pra trabalhar?" (isca do pré-lançamento, rota /quiz).
-- Guarda o lead capturado no gate de e-mail: quem respondeu, em que faixa caiu,
-- qual território ficou mais fraco e as 8 escolhas.
--
-- Segurança: mesma postura de convites_cadastro (20260708120000) e da lista de
-- espera depois de 20260709170200 — RLS ligado com policy deny-all explícita e
-- escrita SOMENTE via service role, na server function src/lib/quiz.functions.ts.
-- Sem policy de leitura pública de propósito: é base de e-mails, um SELECT anon
-- daria pra varrer a lista inteira.

CREATE TABLE public.quiz_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  faixa text,
  territorio_fraco text,
  pontos integer,
  respostas jsonb,
  origem text NOT NULL DEFAULT 'instagram_bio',
  consentimento boolean NOT NULL,
  consent_texto text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE public.quiz_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quiz leads: sem acesso via cliente"
  ON public.quiz_leads
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.quiz_leads IS
  'Leads do quiz público /quiz (isca do pré-lançamento). Uma linha por e-mail: '
  'refazer o quiz com o mesmo e-mail ATUALIZA a linha (upsert por email), nunca duplica. '
  'Acesso SOMENTE via service role em src/lib/quiz.functions.ts.';

COMMENT ON COLUMN public.quiz_leads.email IS
  'Normalizado no servidor: trim + minúsculas. UNIQUE é a chave do upsert.';

COMMENT ON COLUMN public.quiz_leads.respostas IS
  'As 8 escolhas, no formato {"q1":"a","q2":"c",...}. Só ids validados contra o questionário.';

COMMENT ON COLUMN public.quiz_leads.consent_texto IS
  'Frase de consentimento exatamente como foi exibida na tela, pra auditoria LGPD.';
