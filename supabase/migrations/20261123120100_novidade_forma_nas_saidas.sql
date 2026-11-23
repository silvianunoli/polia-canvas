-- Forma de pagamento nas saídas (ONE-207, 23/11/2026). Aplicar junto com o
-- deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Forma de pagamento também nas saídas',
   'As saídas e as contas a pagar agora guardam a forma de pagamento: Pix, boleto, débito, crédito, dinheiro ou link. A conta a pagar lembra a forma de sempre, e o Fechamento do mês mostra quanto saiu em cada uma.',
   '/financeiro#fechamento', 'Ver o fechamento');
