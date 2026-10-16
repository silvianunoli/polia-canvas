-- Cortesia (campanha de criadoras UGC, 16/10/2026): assinatura que nasceu de
-- cupom de 100% no Stripe. O stripe-webhook grava a marca a partir de
-- subscription.metadata.cortesia = "sim". O Founder Dashboard (founder-monitor
-- e polia-admin) ignora essas linhas no MRR, no churn e nos pagamentos falhos.
-- Tem que ir pro banco ANTES do deploy do webhook: o upsert passa a gravar a
-- coluna e, sem ela, todo evento de assinatura falharia.
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS cortesia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assinaturas.cortesia IS
  'Assinatura de cortesia (cupom de 100%). Fora do MRR, churn e pagamentos falhos do Founder Dashboard.';
