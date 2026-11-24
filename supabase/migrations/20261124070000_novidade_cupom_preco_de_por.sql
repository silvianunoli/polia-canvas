-- Novidade do sino: cupom de desconto, preço de-por e busca na Vitrine online
-- (24/11/2026, ONE-239, desenho aprovado pela Sil). Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Cupom de desconto e preço de-por na Vitrine online',
  'A Vitrine online ganhou "Cupons de desconto": a cliente digita o código no carrinho e o pedido chega com o desconto. No cadastro do produto, "Preço antes, riscado" mostra o preço de-por com o selo do desconto. Com 8 produtos ou mais, a loja também tem busca.',
  '/catalogo',
  'Criar um cupom'
);
