-- Fase 3a (VND-05): autorização que começa no TikTok, não na Pólia.
--
-- A conta de teste "Função principal" e, depois, a loja de apps do TikTok
-- autorizam o app pelo lado deles: a volta chega com o code, mas sem o state que
-- a Pólia gerou. Aceitar direto abriria a porta para alguém mandar um link com o
-- code da própria loja e ligar essa loja na conta de outra pessoa. Então a
-- conexão fica em 'aguardando_confirmacao' até a dona da conta clicar em Conectar
-- na tela da Pólia, vendo o nome da loja.

alter table public.canal_conexoes drop constraint if exists canal_conexoes_status_check;
alter table public.canal_conexoes
  add constraint canal_conexoes_status_check
  check (status in ('pendente', 'aguardando_confirmacao', 'conectada', 'erro'));
