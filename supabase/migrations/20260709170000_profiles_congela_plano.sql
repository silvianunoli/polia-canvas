-- SEGURANÇA (bypass de paywall) — congela profiles.plano na policy de update.
--
-- profiles.plano é o entitlement de assinatura: 'beta' libera o app sem
-- cobrança e qualquer outro valor exige assinatura ativa (ver o gate em
-- src/routes/_authenticated.tsx). Só o webhook do Stripe (service role, que
-- ignora RLS) deve gravar esse campo.
--
-- A policy "Users can update own profile" (migração 20260601125046) já
-- congelava is_admin no WITH CHECK, mas deixou plano de fora. Sem esta trava,
-- uma usuária logada — mesmo com plano='cancelada' — fazia
--   PATCH /rest/v1/profiles?id=eq.<próprio_uid>  {"plano":"beta"}
-- com o JWT anon, a RLS aceitava, e no próximo load o app liberava o produto
-- pago de graça, indefinidamente. Aqui espelhamos a trava de is_admin também
-- para plano. Usamos IS NOT DISTINCT FROM para ser seguro a NULL.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())
  AND plano IS NOT DISTINCT FROM (SELECT p.plano FROM public.profiles p WHERE p.id = auth.uid())
);
