-- Novidade do sino (regra de 29/10): várias cores no produto, banner na medida e
-- favicon da loja. Aplicar só junto com o deploy.

insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Vitrine online: mais de uma cor por produto e favicon da loja',
  'Na janela do produto, com a paleta ligada, dá pra deixar a cliente misturar até 2 ou 3 cores, e o pedido chega com as cores na ordem dela. O banner agora sobe só em 1600 x 600 px, pra aparecer inteiro. E a loja ganhou favicon próprio.',
  '/catalogo',
  'Abrir a Vitrine online'
);
