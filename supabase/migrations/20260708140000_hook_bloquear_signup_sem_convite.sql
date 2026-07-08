-- Auth Hook "Before User Created": fecha o bypass do cadastro fechado (beta).
-- A checagem de allowlist em cadastro.tsx roda na camada da aplicação —
-- alguém batendo direto em POST /auth/v1/signup com a chave anon (curl,
-- Postman) ainda conseguia criar conta sem convite. Este hook roda dentro
-- do próprio Supabase Auth, antes do usuário existir em auth.users, e
-- bloqueia QUALQUER caminho de criação de conta (signup por senha e OAuth)
-- pra e-mail fora da allowlist. Precisa ser registrado manualmente em
-- Authentication > Hooks no painel do Supabase (não dá pra habilitar só via SQL).
--
-- Referência: docs.supabase.com — Auth Hooks "Before User Created".
-- Contrato: função recebe jsonb {metadata, user}, devolve '{}'::jsonb pra
-- permitir ou {"error": {"message", "http_code"}} pra bloquear. O usuário
-- ainda NÃO existe em auth.users nesse ponto (sem join possível).

CREATE OR REPLACE FUNCTION public.hook_checar_convite_cadastro(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  email_evento text;
  usado_em_convite timestamptz;
BEGIN
  email_evento := lower(trim(coalesce(event->'user'->>'email', '')));

  IF email_evento = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Cadastro fechado. Pede um convite em usepolia.com.br/lista-de-espera.',
        'http_code', 403
      )
    );
  END IF;

  SELECT usado_em INTO usado_em_convite
  FROM public.convites_cadastro
  WHERE email = email_evento;

  IF NOT FOUND OR usado_em_convite IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Cadastro fechado. Pede um convite em usepolia.com.br/lista-de-espera.',
        'http_code', 403
      )
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

-- Seguindo a recomendação da doc: sem SECURITY DEFINER (evita rodar com os
-- privilégios extensos do dono da função). Grants explícitos só pro role
-- interno do Auth.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_checar_convite_cadastro TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_checar_convite_cadastro FROM authenticated, anon, public;

-- convites_cadastro é RLS deny-all pra authenticated/anon (ver migration
-- 20260708120000) — supabase_auth_admin não herda bypass de RLS por padrão,
-- então precisa de policy própria além do GRANT.
GRANT SELECT ON public.convites_cadastro TO supabase_auth_admin;

CREATE POLICY "supabase_auth_admin le convites para o hook"
  ON public.convites_cadastro
  FOR SELECT
  TO supabase_auth_admin
  USING (true);
