-- Comunidade vira mini cursos (decisão da Sil em 29/10/2026).
--
-- A comunidade (comunidade.usepolia.com.br) deixa de ser lista de artigo solto
-- e passa a ser de mini curso: cada curso tem aulas em ordem, cada aula tem
-- vídeo (Cloudflare Stream) e texto de apoio. Artigo avulso vai pro blog.
--
-- POR QUE A AULA É UMA LINHA DE comunidade_artigos E NÃO TABELA NOVA
-- comunidade_artigos já tem tudo que a aula precisa (slug, título, resumo,
-- markdown, capa, publicado, agendamento, updated_at automático) e já tem a
-- RLS de "só logada lê" e os comentários pendurados nela. Tabela nova
-- duplicaria isso e obrigaria a migrar os comentários. Aqui a aula é o artigo
-- com curso_id + ordem + video_uid.
--
-- QUANDO UM CURSO APARECE
-- Quem decide é o Worker polia-comunidade (src/lib/cursos.functions.ts):
-- curso publicado E toda aula dele com vídeo. Assim o curso pode existir no
-- banco, com texto pronto, esperando a gravação. A admin vê o rascunho.
--
-- O VÍDEO
-- video_uid é o identificador do vídeo no Cloudflare Stream, não uma URL. O
-- vídeo é configurado com "requireSignedURLs": quem assina o acesso é o
-- Worker, depois de conferir a assinatura da Pólia (assertAssinante). Um UID
-- vazado não toca sozinho.

-- ---------------------------------------------------------------------------
-- Cursos
-- ---------------------------------------------------------------------------

CREATE TABLE public.comunidade_cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  titulo text NOT NULL,
  resumo text,
  capa_url text,
  ordem integer NOT NULL DEFAULT 0,
  publicado boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Mesmo desenho de comunidade_artigos: sem anon; escrita pra authenticated
-- porque o editor do office escreve com a sessão da Sil, e a policy de admin
-- abaixo é quem barra assinante comum.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comunidade_cursos TO authenticated;
GRANT ALL ON public.comunidade_cursos TO service_role;

ALTER TABLE public.comunidade_cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comunidade cursos: leitura de publicados por quem esta logada"
  ON public.comunidade_cursos
  FOR SELECT
  TO authenticated
  USING (publicado = true);

CREATE POLICY "Comunidade cursos: admin gerencia tudo"
  ON public.comunidade_cursos
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- A função do trigger é genérica (NEW.updated_at = now()), reaproveitada.
CREATE TRIGGER comunidade_cursos_updated_at
  BEFORE UPDATE ON public.comunidade_cursos
  FOR EACH ROW
  EXECUTE FUNCTION public.tocar_updated_at_comunidade_artigos();

COMMENT ON TABLE public.comunidade_cursos IS
  'Mini cursos da comunidade. As aulas são linhas de comunidade_artigos com curso_id. '
  'O curso só aparece pra assinante quando publicado e com vídeo em todas as aulas '
  '(regra no Worker polia-comunidade, src/lib/cursos.functions.ts).';

-- ---------------------------------------------------------------------------
-- Aula = artigo com curso
-- ---------------------------------------------------------------------------

ALTER TABLE public.comunidade_artigos
  ADD COLUMN curso_id uuid REFERENCES public.comunidade_cursos(id) ON DELETE SET NULL,
  ADD COLUMN ordem integer,
  ADD COLUMN video_uid text,
  ADD COLUMN duracao_min integer;

-- Aula sem curso não tem ordem; aula com curso tem ordem única dentro dele.
ALTER TABLE public.comunidade_artigos
  ADD CONSTRAINT comunidade_artigos_aula_tem_ordem
  CHECK (curso_id IS NULL OR ordem IS NOT NULL);

CREATE UNIQUE INDEX comunidade_artigos_curso_ordem_idx
  ON public.comunidade_artigos (curso_id, ordem)
  WHERE curso_id IS NOT NULL;

-- UID do Stream: 32 caracteres hexadecimais. Barra colar a URL inteira no lugar.
ALTER TABLE public.comunidade_artigos
  ADD CONSTRAINT comunidade_artigos_video_uid_formato
  CHECK (video_uid IS NULL OR video_uid ~ '^[0-9a-f]{32}$');

COMMENT ON COLUMN public.comunidade_artigos.video_uid IS
  'Identificador do vídeo no Cloudflare Stream (32 hex). O vídeo exige URL assinada; '
  'o Worker polia-comunidade assina depois de conferir a assinatura da Pólia.';

-- ---------------------------------------------------------------------------
-- Progresso: aula marcada como concluída
-- ---------------------------------------------------------------------------

CREATE TABLE public.comunidade_progresso (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  aula_id uuid NOT NULL REFERENCES public.comunidade_artigos(id) ON DELETE CASCADE,
  concluida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, aula_id)
);

GRANT SELECT, INSERT, DELETE ON public.comunidade_progresso TO authenticated;
GRANT ALL ON public.comunidade_progresso TO service_role;

ALTER TABLE public.comunidade_progresso ENABLE ROW LEVEL SECURITY;

-- Cada uma vê, marca e desmarca só o próprio progresso. Sem UPDATE de
-- propósito: marcar de novo é apagar e inserir.
CREATE POLICY "Comunidade progresso: cada uma le o proprio"
  ON public.comunidade_progresso
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Comunidade progresso: cada uma marca o proprio"
  ON public.comunidade_progresso
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Comunidade progresso: cada uma desmarca o proprio"
  ON public.comunidade_progresso
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.comunidade_progresso IS
  'Aula concluída por assinante. Escrita pelo Worker polia-comunidade, com user_id '
  'vindo do token, nunca do corpo da requisição.';

-- ---------------------------------------------------------------------------
-- Primeiro curso: Reajuste sem Desculpa (os 6 textos aprovados em 28/10)
-- ---------------------------------------------------------------------------
-- Entra como RASCUNHO (publicado=false). Só abre quando a Sil publicar e as 6
-- aulas tiverem vídeo.

INSERT INTO public.comunidade_cursos (slug, titulo, resumo, ordem, publicado)
VALUES (
  'reajuste-sem-desculpa',
  'Reajuste sem Desculpa',
  'Pra quem vende serviço e não mexe no preço faz tempo. A conta, o preço novo e a mensagem pra cliente, em 3 passos.',
  1,
  false
);

UPDATE public.comunidade_artigos a
   SET curso_id = c.id,
       ordem = v.ordem
  FROM public.comunidade_cursos c,
       (VALUES
         ('quanto-o-seu-preco-de-hoje-paga-de-verdade', 1),
         ('o-preco-novo-e-a-conta-do-medo', 2),
         ('o-aviso-de-reajuste-sem-pedir-licenca', 3),
         ('a-mensagem-do-reajuste-pronta-pra-preencher', 4),
         ('oito-respostas-pra-quando-pedem-desconto', 5),
         ('quantas-vendas-da-pra-perder-no-reajuste', 6)
       ) AS v(slug, ordem)
 WHERE c.slug = 'reajuste-sem-desculpa'
   AND a.slug = v.slug;
