-- Novidade do cadastro de produto em página, com a Calculadora dentro (ONE-254,
-- 24/11/2026). Aplicar junto com o deploy do código.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'O cadastro de produto ganhou espaço e a Calculadora',
  'O "+ Produto" e o "Editar" abrem uma página própria. Na seção Preço, "Calcular o preço" abre a Calculadora ali mesmo, e "Usar esse preço" preenche o preço e o custo. O "Recalcular preço" não sai mais do cadastro.',
  '/produtos/novo',
  'Cadastrar um produto'
);
