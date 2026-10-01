-- Loja de serviços da Pólia (servicos.usepolia.com.br/loja).
--
-- Quem lê o catálogo e grava pedido é o Worker do polia-servicos, sempre pelo
-- service role dentro de server function. Por isso anon e authenticated NÃO
-- têm policy de leitura: só o admin (is_admin) gerencia pelo CMS do polia-admin.
-- Preço mora em centavos (integer) e nunca vem do navegador: o checkout relê
-- o preço daqui no servidor.
--
-- Preço NULL = "sob orçamento" (o botão vira pedido de orçamento, não compra).
-- loja_config.loja_aberta nasce false: a loja existe mas não atende ninguém
-- até a Sil virar a chave.

CREATE TABLE public.loja_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loja_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  categoria_id uuid REFERENCES public.loja_categorias(id) ON DELETE SET NULL,
  nome text NOT NULL,
  resumo text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  -- NULL = sob orçamento
  preco_centavos integer CHECK (preco_centavos IS NULL OR preco_centavos >= 0),
  preco_original_centavos integer CHECK (preco_original_centavos IS NULL OR preco_original_centavos >= 0),
  prazo_entrega text,
  -- lista do que vem no pacote: ["5 imagens em alta", ...]
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- galeria: [{"url": "...", "alt": "..."}]
  imagens jsonb NOT NULL DEFAULT '[]'::jsonb,
  capa_url text,
  destaque boolean NOT NULL DEFAULT false,
  publicado boolean NOT NULL DEFAULT false,
  -- true = depois de pagar a cliente responde um briefing
  exige_briefing boolean NOT NULL DEFAULT true,
  -- true = o preço é sugestão inicial, a Sil ainda vai ajustar
  preco_sugerido boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loja_produtos_categoria_idx ON public.loja_produtos (categoria_id);
CREATE INDEX loja_produtos_publicado_idx ON public.loja_produtos (publicado, ordem);

CREATE TABLE public.loja_cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('percentual', 'valor_fixo')),
  -- percentual: 1..100 | valor_fixo: centavos
  valor integer NOT NULL CHECK (valor > 0),
  ativo boolean NOT NULL DEFAULT true,
  valido_ate timestamptz,
  usos_maximos integer,
  usos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loja_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY,
  status text NOT NULL DEFAULT 'aguardando_pagamento'
    CHECK (status IN ('aguardando_pagamento','pago','em_andamento','entregue','cancelado','reembolsado')),
  nome text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  subtotal_centavos integer NOT NULL CHECK (subtotal_centavos >= 0),
  desconto_centavos integer NOT NULL DEFAULT 0 CHECK (desconto_centavos >= 0),
  total_centavos integer NOT NULL CHECK (total_centavos >= 0),
  cupom_codigo text,
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  briefing jsonb,
  observacoes_internas text,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loja_pedidos_status_idx ON public.loja_pedidos (status, created_at DESC);
CREATE INDEX loja_pedidos_email_idx ON public.loja_pedidos (lower(email));

CREATE TABLE public.loja_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.loja_pedidos(id) ON DELETE CASCADE,
  -- SET NULL: apagar produto do catálogo não pode apagar histórico de venda
  produto_id uuid REFERENCES public.loja_produtos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  preco_centavos integer NOT NULL CHECK (preco_centavos >= 0),
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade BETWEEN 1 AND 20)
);
CREATE INDEX loja_pedido_itens_pedido_idx ON public.loja_pedido_itens (pedido_id);

-- Linha única de configuração (id fixo = 1).
CREATE TABLE public.loja_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  loja_aberta boolean NOT NULL DEFAULT false,
  aviso text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.loja_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Eventos do Stripe já processados (idempotência do webhook).
CREATE TABLE public.loja_stripe_eventos (
  id text PRIMARY KEY,
  tipo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.loja_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER loja_categorias_updated BEFORE UPDATE ON public.loja_categorias
  FOR EACH ROW EXECUTE FUNCTION public.loja_set_updated_at();
CREATE TRIGGER loja_produtos_updated BEFORE UPDATE ON public.loja_produtos
  FOR EACH ROW EXECUTE FUNCTION public.loja_set_updated_at();
CREATE TRIGGER loja_pedidos_updated BEFORE UPDATE ON public.loja_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.loja_set_updated_at();
CREATE TRIGGER loja_config_updated BEFORE UPDATE ON public.loja_config
  FOR EACH ROW EXECUTE FUNCTION public.loja_set_updated_at();

-- RLS: tudo fechado, só admin entra pelo CMS; o Worker usa service role.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['loja_categorias','loja_produtos','loja_cupons','loja_pedidos',
                           'loja_pedido_itens','loja_config','loja_stripe_eventos']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))',
      'Loja: admin gerencia tudo', t);
  END LOOP;
END $$;

-- Bucket público das fotos do catálogo (servidas por getPublicUrl, sem RLS).
-- Só admin sobe e lista, igual ao blog-media.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('loja-imagens', 'loja-imagens', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/avif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Loja imagens: admin lista"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'loja-imagens' AND public.is_admin(auth.uid()));
CREATE POLICY "Loja imagens: admin envia"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'loja-imagens' AND public.is_admin(auth.uid()));
CREATE POLICY "Loja imagens: admin altera"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'loja-imagens' AND public.is_admin(auth.uid()));
CREATE POLICY "Loja imagens: admin apaga"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'loja-imagens' AND public.is_admin(auth.uid()));
