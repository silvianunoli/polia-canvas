-- Cadastro fechado (beta): allowlist de e-mails autorizados a criar conta.
-- Mesma lógica de proteção do google_calendar_conexoes (20260707120000): RLS ligado
-- com policy deny-all explícita, acesso só via service role em server functions.
-- Sem policy de leitura por cliente aqui de propósito — não é dado do usuário,
-- é controle de acesso da plataforma; se um e-mail vazasse via SELECT público,
-- daria pra enumerar quem tem convite.

CREATE TABLE public.convites_cadastro (
  email text PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz
);

ALTER TABLE public.convites_cadastro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Convites: sem acesso via cliente"
  ON public.convites_cadastro
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.convites_cadastro IS
  'Allowlist de e-mails autorizados a criar conta (cadastro fechado/beta). '
  'Acesso SOMENTE via service role em server functions (src/lib/convites.functions.ts). '
  'Adicionar e-mail: insert into convites_cadastro (email) values (lower(trim(''nome@dominio.com'')));';
