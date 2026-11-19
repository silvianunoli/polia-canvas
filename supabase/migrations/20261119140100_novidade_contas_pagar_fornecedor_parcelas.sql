-- Contas a pagar com fornecedor, documento, parcelas e valor pago (ONE-207
-- Fase 1, 19/11/2026). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Contas a pagar com fornecedor, parcelas e valor pago',
   'Cada conta a pagar agora guarda o fornecedor e o documento (nota, boleto ou ID do Pix), e uma compra parcelada vira uma conta por mês. Pagou com juros ou desconto? "Paguei em outra data ou valor" lança o que saiu de fato e mostra a diferença para o valor original.',
   '/financeiro#contas-a-pagar', 'Ver as contas a pagar');
