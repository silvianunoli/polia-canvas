-- Novidade do sino: pagamento no pedido (23/11/2026, pedido da Sil). Aplicar
-- só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Pagamento e taxa no pedido',
  'O Novo pedido ganhou "Onde vendeu", a forma de pagamento e a taxa, que vem das taxas de recebimento. Shopee, TikTok Shop e Mercado Livre usam a taxa de cada um. No pedido aberto, a forma e a taxa aparecem e podem ser trocadas nos pedidos anotados à mão e nos da Vitrine online.',
  '/pedidos',
  'Abrir Pedidos'
);