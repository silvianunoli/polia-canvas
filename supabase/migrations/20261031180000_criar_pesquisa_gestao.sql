-- Terceira pesquisa: gestão do dia a dia (card MARCA-12, novembro/2026).
-- Mede a Pólia One como sistema de gestão: canais, pedidos, o que a marca usa
-- hoje pra controlar e o que faria abrir a Pólia todo dia. Um link só pra quem
-- já criou conta e pra quem chega pelos grupos.
--
-- Nasce DESLIGADA (ativa=false): só uma pesquisa fica pública em /pesquisa por
-- vez. Ativar depois do deploy do código, senão a página não acha a config.
insert into public.pesquisas (slug, titulo, subtitulo, ativa)
values (
  'pesquisa-gestao',
  'Como a sua marca funciona por dentro?',
  'Anônimo. Uns 3 minutos. Sem cadastro.',
  false
)
on conflict (slug) do nothing;
