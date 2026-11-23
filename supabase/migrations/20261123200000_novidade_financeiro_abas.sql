-- Financeiro reorganizado em abas (ONE-230, 23/11/2026). Aplicar junto com o
-- deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('O Financeiro ficou mais fácil de ler',
   'O mês e os botões de entrada, saída e venda ficam no topo, e o resto foi pra abas: Lançamentos, A pagar, A receber e Fechamento, cada uma com quanto tem dentro. Importar extrato e Resumo pro contador estão no botão "Mais".',
   '/financeiro', 'Abrir o Financeiro');
