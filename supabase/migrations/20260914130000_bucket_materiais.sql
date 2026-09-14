-- Bucket PRIVADO pros materiais gateados (hoje, o PDF do manual de /manual).
--
-- O arquivo saiu de public/ do app de propósito: o servidor de assets do
-- Cloudflare entrega o que está lá antes do Worker rodar, então qualquer PDF
-- em public/ é link público, e o gate de e-mail vira enfeite. Aqui ele só
-- sai pelo service role, na rota /manual/baixar (src/lib/manual/download.server.ts),
-- depois de conferir o token em manual_leads.
--
-- Sem policy nenhuma em storage.objects pra este bucket, de propósito: com a
-- RLS ligada e nenhuma policy permissiva, anon e authenticated não leem, não
-- listam e não gravam. Quem acessa é só o service role.
--
-- O upload do PDF não é migration (é binário): vai pela API do Storage com o
-- service role, uma vez, e o objeto se chama manual-pequena-marca.pdf.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('materiais', 'materiais', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
