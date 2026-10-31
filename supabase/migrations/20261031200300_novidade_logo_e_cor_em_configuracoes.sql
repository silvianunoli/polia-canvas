-- O Planejamento saiu da Pólia One (31/10/2026) e, com ele, a tela Marca, onde
-- moravam o logo e a cor que vão no orçamento e na loja do Catálogo. O logo e a
-- cor foram pra Configurações. Aviso no sino pra quem procurar em Marca.
-- Aplicar junto com o deploy do código (regra do sino). A Sil decide se o
-- texto fala da saída do Planejamento ou só da mudança de lugar do logo.
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Logo e cor da marca agora ficam em Configurações',
   'O logo e a cor que vão no topo do orçamento e na loja do Catálogo saíram da tela Marca e agora ficam em Configurações, na parte Logo e cor. O que já estava salvo continua igual.',
   '/configuracoes', 'Abrir Configurações');
