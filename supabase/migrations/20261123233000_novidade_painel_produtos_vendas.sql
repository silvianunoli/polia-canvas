-- Novidade do sino: bloco "Produtos e vendas · mês" no Painel (23/11/2026,
-- pedido da Sil). Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Produtos e vendas no Painel',
  'O Painel ganhou o bloco "Produtos e vendas · mês": produtos ativos, inativos e sem estoque, o ticket médio do mês e os três mais e os três menos vendidos. Ele entra no lugar do cartão "Vendas · mês".',
  '/painel',
  'Abrir o Painel'
);
