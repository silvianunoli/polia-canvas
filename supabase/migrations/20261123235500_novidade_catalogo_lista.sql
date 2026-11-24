-- Novidade do sino: Catálogo de Produtos em lista com chaves (23/11/2026,
-- pedido da Sil). Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Catálogo em lista, com chaves',
  'O Catálogo de Produtos virou uma lista com foto, preço, custo e lucro. Cada linha tem a chave "Vitrine", que liga o produto na Vitrine online, e a chave "Ativo", que ativa ou desativa o produto. Clique no título de uma coluna pra ordenar.',
  '/produtos',
  'Abrir Produtos'
);
