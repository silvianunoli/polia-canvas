-- Preço de-por no modelo novo (24/11/2026, ONE-239). Aplicar só depois do
-- deploy do código que lê preco_promocional.
--
-- Por algumas horas, o de-por usou produtos.preco_de como o "antes" e o
-- preco_venda como o "por". A Sil pediu o contrário: preço de venda é o "de" e o
-- preço promocional é o "por". Aqui o produto que já tinha preco_de passa pro
-- modelo novo, com a mesma vitrine (só o "Caderno clube das exaustas", de teste
-- da Sil: venda 120,00 e promocional 56,90), e a coluna velha sai.
update public.produtos
   set preco_promocional = preco_venda,
       preco_venda = preco_de,
       updated_at = now()
 where preco_de is not null
   and preco_de > preco_venda;

alter table public.produtos drop column if exists preco_de;

-- A novidade de antes falava em "Preço antes, riscado", campo que saiu. Ela
-- desliga (quem leu tem linha em novidades_lidas) e entra a certa.
update public.novidades
   set ativa = false
 where titulo = 'Cupom de desconto e preço de-por na Vitrine online'
   and texto like '%Preço antes, riscado%';

insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Cupom de desconto e preço promocional',
  'A Vitrine online ganhou "Cupons de desconto": a cliente digita o código no carrinho e o pedido chega com o desconto. No cadastro do produto, o "Preço promocional" vira o preço que vale em todo o sistema, e a vitrine mostra o preço de venda riscado. Com 8 produtos ou mais, a loja também tem busca.',
  '/produtos',
  'Abrir Produtos'
);
