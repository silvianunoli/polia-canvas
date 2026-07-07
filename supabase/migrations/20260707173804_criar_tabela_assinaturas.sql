CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assinaturas IS 'Assinatura Stripe da usuária. Só o service role escreve (server functions + webhook) — sem policy de INSERT/UPDATE/DELETE pra usuária, só SELECT.';

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assinaturas: dona seleciona" ON public.assinaturas
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_assinaturas_stripe_subscription_id ON public.assinaturas(stripe_subscription_id);
CREATE INDEX idx_assinaturas_user_id ON public.assinaturas(user_id);
