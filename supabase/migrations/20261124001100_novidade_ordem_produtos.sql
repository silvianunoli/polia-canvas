-- Novidade do sino: coluna "Ordem" na lista de Produtos (23/11/2026, pedido
-- da Sil). Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Ordem dos produtos na lista',
  'A lista de Produtos ganhou a coluna "Ordem", à esquerda da foto. O número digitado define a posição do produto na lista e na Vitrine online. Quem fica sem número vem depois, do cadastro mais recente pro mais antigo.',
  '/produtos',
  'Abrir Produtos'
);