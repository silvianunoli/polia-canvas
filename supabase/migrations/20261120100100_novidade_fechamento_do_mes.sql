-- Fechamento do mês no Financeiro (ONE-207 Fase 3, 20/11/2026). Aplicar junto
-- com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Fechamento do mês por forma de recebimento',
   'O Financeiro agora mostra quanto entrou em Pix, dinheiro, débito, crédito e link no mês, dia a dia, pra bater com o banco e a maquininha. Também mostra taxas e juros do mês e baixa a planilha com valor original e valor pago ou recebido.',
   '/financeiro#fechamento', 'Ver o fechamento');
