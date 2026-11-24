-- Projeção mostra quanto falta no mês (ONE-241). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('A Projeção agora mostra quanto falta no mês',
   'A Projeção desconta o que já entrou no Financeiro e mostra quantas vendas ainda faltam pra empatar, pagar o seu salário e bater a meta. Os custos fixos partem do último mês fechado, e os cenários de preço e custo mostram o número do mês real ao lado.',
   '/projecao', 'Abrir a Projeção');
