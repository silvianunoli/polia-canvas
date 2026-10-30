-- Virada de preços de 01/12/2026 (PAY-43/44/45): Raio-x, Projeção, Encomenda e
-- Resumo pro contador descem do Pro pro Premium. A novidade fica agendada pra
-- aparecer no sino só a partir da virada (VIRADA_PRECOS em src/lib/planos.ts),
-- quando as telas abrem de fato pro Premium.
insert into public.novidades (titulo, texto, link, link_rotulo, publicada_em) values
  ('Raio-x, Projeção, Encomenda e Resumo agora no Premium',
   'O Premium passa a ler o mês no Raio-x, a mostrar na Projeção quantas vendas faltam pra empatar e bater a meta, a calcular a encomenda sob medida e a montar o resumo do mês pro contador. Quem já assina o Premium continua pagando o mesmo valor.',
   '/raiox', 'Abrir o Raio-x', '2026-12-01 00:00:00-03');
