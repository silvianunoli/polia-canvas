-- SEGURANÇA (DoS do cadastro fechado) — marca o convite como usado no SERVIDOR.
--
-- Antes, o convite era marcado por uma server function PÚBLICA (marcarConviteUsado)
-- que aceitava e-mail arbitrário do request e escrevia via service role (bypassa
-- a RLS deny-all de convites_cadastro). Qualquer pessoa não autenticada podia
-- POSTar {email:'alvo'} e invalidar o convite de qualquer e-mail — travando o
-- cadastro daquela pessoa (o Auth Hook e o cadastro.tsx passam a barrar quem tem
-- usado_em != null). Iterando sobre e-mails, dava pra zerar o funil de onboarding.
--
-- A marcação agora acontece via trigger AFTER INSERT em auth.users — no momento
-- em que a conta é DE FATO criada (signup por senha OU OAuth), não por uma
-- chamada pública. A server function marcarConviteUsado foi removida do código.
CREATE OR REPLACE FUNCTION public.marcar_convite_usado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.convites_cadastro
  SET usado_em = now()
  WHERE email = lower(trim(NEW.email))
    AND usado_em IS NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_convite_usado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_marcar_convite ON auth.users;
CREATE TRIGGER on_auth_user_created_marcar_convite
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.marcar_convite_usado();
