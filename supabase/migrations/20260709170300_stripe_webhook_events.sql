-- SEGURANÇA/robustez (idempotência do webhook) — dedup de eventos do Stripe.
--
-- O Stripe reentrega eventos (retry em qualquer resposta não-2xx e, às vezes,
-- duplicatas). As escritas no banco do webhook são idempotentes (update/upsert),
-- mas os efeitos colaterais de e-mail (ativação, cancelamento, pagamento
-- recusado, renovação) reenviavam a cada entrega. Registrando event.id aqui e
-- ignorando o que já foi processado, o webhook fica idempotente.
--
-- Só o service role (o próprio webhook) acessa — RLS ligada e sem policies
-- nega authenticated/anon; service role ignora RLS.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.stripe_webhook_events TO service_role;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
