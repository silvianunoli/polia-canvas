-- Novidade (sino): marcar vários produtos e ativar, inativar, pôr ou tirar da
-- Vitrine ou excluir de uma vez. Entra junto com o deploy do código, depois da
-- função excluir_produtos (20261127230000), nunca antes.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Vários produtos de uma vez e o Excluir',
  'Em Produtos, a caixa à esquerda de cada linha marca um, vários ou todos os produtos da lista. Com eles marcados, a barra embaixo ativa, inativa, põe ou tira da Vitrine e exclui de uma vez. Cada produto também ganhou o Excluir no menu da linha, com confirmação, porque a exclusão não pode ser desfeita.',
  '/produtos',
  'Abrir Produtos'
);
