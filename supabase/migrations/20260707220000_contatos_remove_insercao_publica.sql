-- O insert em public.contatos passou a acontecer só pela server function
-- enviarContato (service role via supabaseAdmin), que já valida e roda o
-- honeypot antes de gravar. A policy pública de INSERT não é mais necessária
-- e ficava com WITH CHECK (true), aceitando insert de qualquer origem.
DROP POLICY IF EXISTS "Contatos: insercao publica" ON public.contatos;
