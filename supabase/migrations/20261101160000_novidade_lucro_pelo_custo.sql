-- O "Quanto lucrou" do Painel, do Financeiro e da aba Hoje passou a descontar o
-- custo de cada produto vendido (src/lib/lucroDoMes.ts), o mesmo número do
-- cartão de Vendas; e a Calculadora ganhou o campo "Qual produto?" (ONE-165,
-- 01/11/2026). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('O "Quanto lucrou" agora desconta o custo de cada produto',
   'O Painel e o Financeiro tiram do lucro do mês o custo de cada produto vendido, o mesmo número do cartão de Vendas. E na Calculadora o campo "Qual produto?" dá nome ao preço antes de guardar.',
   '/painel', 'Ver o Painel');
