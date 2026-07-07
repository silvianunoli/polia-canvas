-- google_calendar_conexoes guarda tokens OAuth do Google (access_token / refresh_token),
-- o dado mais sensível do sistema. A tabela já tinha RLS habilitado, mas ZERO policies —
-- o que hoje nega tudo para anon/authenticated por default-deny (só o service role, que
-- ignora RLS, acessa via server functions). O problema é que essa segurança é implícita:
-- basta alguém criar uma policy "de conveniência" no futuro para expor tokens de todas.
--
-- Tornamos a intenção EXPLÍCITA com uma policy deny-all. Não muda o comportamento atual
-- (o service role continua acessando; o cliente continua sem acesso), mas trava a intenção:
-- qualquer acesso via cliente passa a ser uma decisão deliberada, nunca um acidente.
-- NÃO criar policy de SELECT por dono aqui — isso exporia access_token/refresh_token ao
-- browser. Esses campos só podem ser lidos pelo servidor (service role).

CREATE POLICY "GCal: sem acesso via cliente"
  ON public.google_calendar_conexoes
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.google_calendar_conexoes IS
  'Tokens OAuth do Google. Acesso SOMENTE via service role em server functions. '
  'Nunca criar policy de leitura por usuária: access_token/refresh_token não podem ir ao cliente.';
