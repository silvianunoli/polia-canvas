-- Novidade do sino (regra de 29/10): Vitrine online no Premium e produto de
-- pronta entrega. Aplicar só junto com o deploy.

insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Vitrine online no Premium e produto de pronta entrega',
  'A Vitrine online agora vale também no plano Premium. E cada produto da vitrine pode ser sob encomenda ou pronta entrega: em Produtos, abra o produto e escolha. Pronta entrega com estoque ligado aparece como esgotado quando acaba.',
  '/catalogo',
  'Abrir a Vitrine online'
);
