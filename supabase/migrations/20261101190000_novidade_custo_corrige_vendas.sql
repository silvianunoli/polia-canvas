-- Custo cadastrado depois preenche as vendas que ficaram sem ele, venda sem
-- custo não derruba mais o mês inteiro, e o "Registrar venda" do Financeiro
-- abre o formulário de Vendas (ONE-166, 01/11/2026). Aplicar junto com o
-- deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Custo preenchido depois agora corrige as vendas antigas',
   'Produto vendido antes de ter custo: preencha o custo em Produtos e as vendas dele passam a descontar esse custo no "Quanto lucrou". E o "Registrar venda" do Financeiro abre o mesmo formulário de Vendas, que guarda o custo de cada produto.',
   '/produtos', 'Abrir Produtos');
