
-- blog_posts
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  resumo text,
  conteudo_md text,
  categoria text,
  publicado boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog: leitura publica de publicados"
  ON public.blog_posts FOR SELECT
  USING (publicado = true);

-- lista_espera
CREATE TABLE public.lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  tipo_negocio text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.lista_espera TO anon, authenticated;
GRANT ALL ON public.lista_espera TO service_role;

ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lista espera: insercao publica"
  ON public.lista_espera FOR INSERT
  WITH CHECK (true);
