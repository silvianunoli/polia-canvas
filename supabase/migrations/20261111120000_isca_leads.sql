-- Leads das iscas em PDF de /materiais/<slug> (carrosséis do @polialab: a
-- pessoa comenta uma palavra, recebe o link no Direct, deixa e-mail e WhatsApp
-- e baixa o PDF na hora, com cópia por e-mail).
--
-- Uma tabela pra todas as iscas, com a isca na coluna isca_slug. O catálogo
-- (título, arquivo, consentimento, e-mail) mora em código, em
-- src/lib/iscas/catalogo.ts; aqui fica só quem pediu o quê.
--
-- Segurança: mesma postura de manual_leads (20260914120000). RLS ligada e
-- NENHUMA policy: anon e authenticated não leem nem escrevem. A escrita é só
-- via service role, na server function src/lib/iscas.functions.ts, e a
-- leitura do token de download só no Worker (src/lib/iscas/download.server.ts).
--
-- Diferença do manual: telefone é NOT NULL. O WhatsApp é obrigatório nesta
-- isca, e o servidor normaliza (whatsappDaConta: 55 + DDD + número) antes
-- de gravar.

CREATE TABLE public.isca_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isca_slug text NOT NULL CHECK (isca_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  email text NOT NULL,
  telefone text NOT NULL CHECK (telefone ~ '^55[0-9]{10,11}$'),
  origem text NOT NULL DEFAULT 'instagram_direct',
  consentimento boolean NOT NULL,
  consent_texto text,
  download_token uuid NOT NULL DEFAULT gen_random_uuid(),
  descadastro_token uuid NOT NULL DEFAULT gen_random_uuid(),
  descadastrado_em timestamptz,
  baixado_em timestamptz,
  downloads integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT isca_leads_email_isca_slug_key UNIQUE (email, isca_slug)
);

ALTER TABLE public.isca_leads ENABLE ROW LEVEL SECURITY;
-- Sem CREATE POLICY de propósito: com a RLS ligada e nenhuma policy, o acesso
-- de anon e authenticated é negado por padrão (deny-all).

-- Os dois tokens são chave de busca de link: únicos e indexados.
CREATE UNIQUE INDEX isca_leads_download_token_key
  ON public.isca_leads (download_token);
CREATE UNIQUE INDEX isca_leads_descadastro_token_key
  ON public.isca_leads (descadastro_token);

-- O descadastro por um link vale pra todas as iscas do mesmo e-mail
-- (marcarDescadastro em src/lib/quiz.functions.ts filtra por email). O índice
-- da UNIQUE (email, isca_slug) já cobre a busca por email.

COMMENT ON TABLE public.isca_leads IS
  'Leads das iscas em PDF (/materiais/<slug>). Uma linha por e-mail POR isca: pedir a mesma '
  'isca de novo ATUALIZA a linha (upsert em email + isca_slug). Acesso SOMENTE via service role '
  'em src/lib/iscas.functions.ts e src/lib/iscas/download.server.ts.';

COMMENT ON COLUMN public.isca_leads.isca_slug IS
  'Chave da isca em src/lib/iscas/catalogo.ts (ex.: black-friday). É também o slug da URL.';

COMMENT ON COLUMN public.isca_leads.email IS
  'Normalizado no servidor: trim + minúsculas.';

COMMENT ON COLUMN public.isca_leads.telefone IS
  'WhatsApp obrigatório, normalizado: 55 + DDD + número, só dígitos (mesmo formato de crm_contatos.telefone).';

COMMENT ON COLUMN public.isca_leads.consent_texto IS
  'Frase de consentimento exatamente como foi exibida na tela, pra auditoria LGPD.';

COMMENT ON COLUMN public.isca_leads.download_token IS
  'Segredo do link de download (/materiais/<slug>/baixar?t=...). O Worker só entrega o PDF '
  'pra token que existe aqui E é da mesma isca do caminho.';

COMMENT ON COLUMN public.isca_leads.descadastro_token IS
  'Segredo do link de descadastro (/descadastrar?t=...). Nunca expor em lista nem em tela.';

COMMENT ON COLUMN public.isca_leads.descadastrado_em IS
  'Preenchido quando a pessoa pede pra sair, em TODAS as linhas do mesmo e-mail. Pedir outra '
  'isca pelo formulário público não limpa o campo (LGPD, 08/10/2026): a linha nova herda a data.';

COMMENT ON COLUMN public.isca_leads.downloads IS
  'Quantas vezes o link entregou o arquivo. Métrica, não trava.';

-- ── Bucket privado dos PDFs ────────────────────────────────────────────────
-- Mesmo desenho do bucket `materiais` (20260914130000): sem policy nenhuma em
-- storage.objects pra este bucket, então só o service role lê. O upload do
-- PDF não é migration (é binário): vai pela API do Storage, um objeto por
-- isca, com o nome do campo `objeto` do catálogo
-- (ex.: iscas/checklist-black-friday-polia.pdf).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('iscas', 'iscas', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ── Espelho no CRM do office (crm_contatos) ────────────────────────────────
-- manual_leads e quiz_leads caem no CRM pelo gatilho compartilhado
-- crm_tg_espelhar (20260918213000). Aqui o gatilho é PRÓPRIO, de propósito:
-- recriar crm_tg_espelhar pra acrescentar um ramo arriscaria apagar qualquer
-- ajuste que a versão no ar tenha e o arquivo não. Este só chama a mesma
-- crm_espelhar_contato (dedupe por lower(email), contato existente só ganha
-- campo vazio, descadastro de qualquer fonte manda).
--
-- origem no CRM = 'isca_pdf' (a isca exata fica em isca_leads.isca_slug).
-- Falha do espelho nunca derruba o cadastro da lead: vira warning.

CREATE OR REPLACE FUNCTION public.crm_tg_espelhar_isca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public.crm_espelhar_contato(
    NEW.email,
    NULL,
    'isca_pdf',
    NEW.telefone,
    NULL,
    coalesce(NEW.consentimento, false),
    NEW.consent_texto,
    NEW.descadastrado_em,
    NULL,
    'lead',
    NEW.created_at
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'crm_tg_espelhar_isca falhou (%): %', coalesce(NEW.email, '?'), sqlerrm;
    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.crm_tg_espelhar_isca() IS
  'Espelha isca_leads em crm_contatos via crm_espelhar_contato. Erro vira warning: nunca derruba a inserção.';

DROP TRIGGER IF EXISTS crm_espelho_isca_leads ON public.isca_leads;
CREATE TRIGGER crm_espelho_isca_leads
  AFTER INSERT OR UPDATE OF descadastrado_em, telefone ON public.isca_leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_tg_espelhar_isca();

-- SECURITY DEFINER escrevendo em tabela sem policy: fora do alcance do
-- PostgREST pra anon e authenticated (mesmo cuidado de 20260918213000).
REVOKE ALL ON FUNCTION public.crm_tg_espelhar_isca() FROM public, anon, authenticated;
