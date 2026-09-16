-- Comunidade da Pólia (comunidade.usepolia.com.br, Worker próprio no repo
-- polia-comunidade/): conteúdo educativo pra quem assina, com comentário
-- simples embaixo de cada artigo.
--
-- POR QUE TABELA NOVA E NÃO UMA COLUNA `destino` EM blog_posts
-- A policy de leitura do blog é `USING (publicado = true)` valendo pra anon
-- E authenticated (migração 20260528140512) -- o blog é público de propósito.
-- Artigo de comunidade dentro de blog_posts herdaria essa policy: bastaria um
-- GET no PostgREST com a chave anon pra ler, sem assinar, conteúdo que é o
-- produto pago. Consertar isso exigiria reescrever a policy do blog em
-- produção e filtrar `destino` em toda consulta do site público. Tabela
-- separada resolve na origem: aqui a leitura já nasce exigindo autenticação.
--
-- ONDE FICA O PORTÃO DE ASSINATURA
-- Na camada de app, como no resto do projeto: profiles.plano é a fonte única
-- do direito de acesso (o webhook do Stripe grava lá), e quem confere é
-- assertAssinante() em polia-comunidade/src/lib/comunidade.functions.ts. A RLS
-- aqui garante o piso -- "precisa estar logada" -- e não tenta reimplementar
-- entitlement de assinatura em SQL.
--
-- AUTORIA
-- Escrever/publicar artigo acontece no polia-admin (office.usepolia.com.br),
-- em /comunidade, reusando o mesmo editor do blog. A comunidade em si é só
-- leitura + comentário: nada de escrever conteúdo por lá.

-- ---------------------------------------------------------------------------
-- Artigos
-- ---------------------------------------------------------------------------

CREATE TABLE public.comunidade_artigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  resumo text,
  conteudo_md text,
  categoria text,
  capa_url text,
  tempo_leitura integer,
  publicado boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  agendado_para timestamptz,
  autor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comunidade_artigos_publicados_idx
  ON public.comunidade_artigos (publicado_em DESC)
  WHERE publicado = true;

-- Sem GRANT pra anon: é o ponto inteiro desta tabela existir separada do blog.
--
-- INSERT/UPDATE/DELETE entram pra authenticated porque o editor do polia-admin
-- escreve pelo client, com a sessão da Sil. Quem barra assinante comum não é o
-- GRANT, é a policy de admin logo abaixo: GRANT abre a porta, RLS decide quem
-- passa. Sem estes três, o editor falharia com 42501 mesmo sendo admin.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunidade_artigos TO authenticated;
GRANT ALL ON public.comunidade_artigos TO service_role;

ALTER TABLE public.comunidade_artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comunidade artigos: leitura de publicados por quem esta logada"
  ON public.comunidade_artigos
  FOR SELECT
  TO authenticated
  USING (publicado = true);

-- Rascunho e agendado só aparecem pra admin (é o editor no polia-admin).
CREATE POLICY "Comunidade artigos: admin gerencia tudo"
  ON public.comunidade_artigos
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

COMMENT ON TABLE public.comunidade_artigos IS
  'Artigos da comunidade (comunidade.usepolia.com.br). Separada de blog_posts porque '
  'o blog é público (policy vale pra anon) e isto aqui é conteúdo de assinante. '
  'Escrita pelo editor em polia-admin /comunidade; leitura pelo Worker polia-comunidade.';

COMMENT ON COLUMN public.comunidade_artigos.agendado_para IS
  'Timestamp UTC. O pg_cron publicar-artigos-comunidade (abaixo) marca publicado=true '
  'sozinho quando a data chega. Mesmo desenho do agendamento do blog: nunca setar '
  'publicado=true na mão num artigo que devia esperar a data.';

COMMENT ON COLUMN public.comunidade_artigos.capa_url IS
  'URL pública do bucket blog-media (o mesmo do blog, de propósito: só admin sobe '
  'imagem nos dois, não vale criar bucket e policy novos pra repetir a mesma regra).';

-- ---------------------------------------------------------------------------
-- Comentários
-- ---------------------------------------------------------------------------
--
-- Comentário simples: lista cronológica por artigo. Sem voto, sem resposta
-- aninhada, sem tópico solto. Se um dia virar fórum, isso é redesenho, não
-- uma coluna a mais.

CREATE TABLE public.comunidade_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artigo_id uuid NOT NULL REFERENCES public.comunidade_artigos(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  corpo text NOT NULL CHECK (char_length(btrim(corpo)) BETWEEN 2 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comunidade_comentarios_artigo_idx
  ON public.comunidade_comentarios (artigo_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.comunidade_comentarios TO authenticated;
GRANT ALL ON public.comunidade_comentarios TO service_role;

ALTER TABLE public.comunidade_comentarios ENABLE ROW LEVEL SECURITY;

-- Leitura: só comentário de artigo publicado, e só pra quem está logada.
CREATE POLICY "Comunidade comentarios: leitura em artigo publicado"
  ON public.comunidade_comentarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.comunidade_artigos a
      WHERE a.id = comunidade_comentarios.artigo_id
        AND a.publicado = true
    )
  );

-- Inserção: só em nome de si mesma (autor_id = auth.uid()) e só em artigo
-- publicado. Sem o primeiro teste, dava pra assinar comentário como outra
-- pessoa; sem o segundo, dava pra comentar num rascunho sabendo o id.
CREATE POLICY "Comunidade comentarios: cada uma insere o proprio"
  ON public.comunidade_comentarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.comunidade_artigos a
      WHERE a.id = comunidade_comentarios.artigo_id
        AND a.publicado = true
    )
  );

-- Apagar: só o próprio comentário. A admin também apaga (moderação) -- sem
-- isso, um comentário abusivo só sairia por SQL manual.
CREATE POLICY "Comunidade comentarios: apagar o proprio ou moderar como admin"
  ON public.comunidade_comentarios
  FOR DELETE
  TO authenticated
  USING (autor_id = auth.uid() OR public.is_admin(auth.uid()));

-- UPDATE não tem policy de propósito: comentário publicado não se edita.
-- Sem policy = negado, que é o comportamento desejado.

COMMENT ON TABLE public.comunidade_comentarios IS
  'Comentário simples por artigo da comunidade: lista cronológica, sem voto e sem '
  'resposta aninhada. Escrita e exclusão passam por polia-comunidade/src/lib/'
  'comunidade.functions.ts, que valida o token e reconfere a assinatura antes.';

-- ---------------------------------------------------------------------------
-- updated_at automático nos artigos
-- ---------------------------------------------------------------------------
-- A lista do admin ordena por updated_at; sem trigger ela ficaria congelada na
-- data de criação (a UI não manda esse campo no payload).

CREATE OR REPLACE FUNCTION public.tocar_updated_at_comunidade_artigos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER comunidade_artigos_updated_at
  BEFORE UPDATE ON public.comunidade_artigos
  FOR EACH ROW
  EXECUTE FUNCTION public.tocar_updated_at_comunidade_artigos();

-- Revoke depois do CREATE TRIGGER de propósito: o Postgres checa EXECUTE na
-- criação do trigger, não a cada disparo.
REVOKE EXECUTE ON FUNCTION public.tocar_updated_at_comunidade_artigos() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Publicação agendada
-- ---------------------------------------------------------------------------
-- Espelha o que o blog já faz em produção (publish_due_posts + pg_cron
-- publish-due-blog-posts, aplicados fora deste histórico de migração). Função
-- separada de propósito: não mexer na do blog, que está no ar e funcionando.

CREATE OR REPLACE FUNCTION public.publicar_artigos_comunidade_agendados()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.comunidade_artigos
     SET publicado = true,
         publicado_em = COALESCE(publicado_em, agendado_para),
         agendado_para = NULL
   WHERE publicado = false
     AND agendado_para IS NOT NULL
     AND agendado_para <= now();
$$;

-- SECURITY DEFINER sem revoke seria uma função de publicar artigo aberta pra
-- qualquer usuária logada chamar via RPC.
REVOKE EXECUTE ON FUNCTION public.publicar_artigos_comunidade_agendados() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'publicar-artigos-comunidade',
  '* * * * *',
  $$SELECT public.publicar_artigos_comunidade_agendados()$$
);
