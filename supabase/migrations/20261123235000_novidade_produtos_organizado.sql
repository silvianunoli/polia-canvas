-- Novidade do sino: Produtos reorganizado (23/11/2026, pedido da Sil).
-- Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Produtos mais fácil de achar',
  'O Catálogo ganhou filtros (Na Vitrine, Fora da Vitrine, Sem custo e Arquivados) e um seletor de ordem. Produto arquivado agora aparece no filtro "Arquivados" e volta com "Reativar". A aba de insumos virou "Materiais e receitas", com uma lista por vez.',
  '/produtos',
  'Abrir Produtos'
);
