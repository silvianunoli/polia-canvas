-- Novidade do sino (regra de 29/10): categorias na Vitrine online. Aplicar só
-- junto com o deploy do código.

insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Categorias na Vitrine online',
  'Cada produto da vitrine pode ganhar uma categoria, e a loja mostra botões pra cliente filtrar o que procura. Com banner, o nome da loja fica em cima dele e aparece uma vez só.',
  '/catalogo',
  'Escolher as categorias'
);
