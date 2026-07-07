-- O bucket blog-media é público: imagens dos posts são servidas via getPublicUrl
-- (/object/public/...), que NÃO passa por RLS. A policy SELECT "public" só servia pra
-- permitir LISTAR todos os arquivos via API — o que expõe mídia de rascunhos/agendados.
-- O código nunca lista (só upload + getPublicUrl), então trocamos por listagem só-admin.
DROP POLICY IF EXISTS "Blog media: leitura publica" ON storage.objects;

CREATE POLICY "Blog media: admin lista"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'blog-media' AND is_admin(auth.uid()));
