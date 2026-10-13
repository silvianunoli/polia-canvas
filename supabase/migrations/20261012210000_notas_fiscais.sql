-- PAY-32 (12/10/2026): nota fiscal automática de cada fatura paga, pela NFE.io.
--
-- Uma linha por fatura do Stripe. O stripe-webhook cria a linha no invoice.paid,
-- pede a NFS-e e guarda o id da NFE.io; no charge.refunded (reembolso total)
-- usa esse id pra cancelar a nota sem ninguém precisar abrir o painel.
--
-- Sem user_id de propósito: a varredura de exclusão de conta
-- (excluir_dados_da_usuaria) apaga toda tabela com user_id, e nota fiscal é
-- registro fiscal que a empresa guarda por 5 anos. A ligação com a cliente é
-- pelo customer do Stripe.
--
-- RLS ligado e sem policy: só o service_role (webhook) lê e escreve.

CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  valor_centavos integer NOT NULL CHECK (valor_centavos >= 0),
  status text NOT NULL DEFAULT 'emitindo'
    CHECK (status IN ('emitindo', 'emitida', 'erro_emissao', 'cancelada', 'erro_cancelamento')),
  nfeio_id text,
  nfeio_status text,
  -- Só a mensagem da NFE.io (sem payload da cliente), pra Sil saber o que travou.
  erro text,
  tentativas integer NOT NULL DEFAULT 0,
  emitida_em timestamptz,
  cancelada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notas_fiscais_status_idx ON public.notas_fiscais (status);

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notas_fiscais FROM anon, authenticated;
