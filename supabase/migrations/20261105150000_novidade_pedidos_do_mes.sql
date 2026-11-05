-- "Pedidos · mês" passa a contar venda a receber e bate com "Vendas · mês"
-- (ONE-172, 05/11/2026). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('O cartão "Pedidos · mês" agora conta o que está a receber',
   'O número de pedidos do Painel passou a contar as vendas do mês, pagas e a receber, e bate com o cartão "Vendas · mês". Entrada de venda ou serviço lançada à mão continua contando, e a frase do cartão diz quantas são.',
   '/painel', 'Abrir o Painel');
