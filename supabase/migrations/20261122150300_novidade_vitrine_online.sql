-- Novidade do sino (regra de 29/10): Vitrine online com banner e ordem dos
-- produtos, e marketplaces nas taxas. Aplicar só junto com o deploy do código.

insert into public.novidades (titulo, texto, link, link_rotulo)
values
  (
    'O Catálogo agora se chama Vitrine online',
    'A loja da marca ganhou banner rotativo no topo, com até 5 imagens, e setas pra escolher quais produtos aparecem primeiro. O interruptor "Loja aberta" passou a valer na hora.',
    '/catalogo',
    'Abrir a Vitrine online'
  ),
  (
    'Marketplaces nas taxas de recebimento',
    'Em Vendas, no modal de taxas, a Shopee, o TikTok Shop e o Mercado Livre têm campo pra preencher, e dá pra adicionar outro marketplace com o nome dele. A Pólia One usa essas taxas no lucro por canal.',
    '/vendas',
    'Ver as taxas'
  );
