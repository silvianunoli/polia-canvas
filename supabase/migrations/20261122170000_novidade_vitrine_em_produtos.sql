-- Novidade do sino (regra de 29/10): o produto entra na Vitrine online pela
-- janela dele, em Produtos. Aplicar só junto com o deploy do código.

insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Produto entra na Vitrine online por Produtos',
  'Abra o produto em Produtos e marque "Mostrar na Vitrine online". A tela Vitrine online fica com a ordem, a categoria e as fotos dos produtos marcados.',
  '/produtos',
  'Abrir Produtos'
);
