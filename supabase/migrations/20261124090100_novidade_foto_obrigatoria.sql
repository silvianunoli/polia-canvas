-- Novidade do sino: foto obrigatória na loja (24/11/2026, ONE-239, decisão da
-- Sil). Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Produto sem foto fica fora da loja',
  'Na Vitrine online e na Loja da marca, só aparece produto com foto. Na lista de Produtos, o aviso "sem foto" ao lado da chave "Vitrine" mostra quem está marcado pra loja e ainda precisa de uma foto.',
  '/produtos',
  'Abrir Produtos'
);
