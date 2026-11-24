-- Novidades dos Custos da marca, da calculadora enxuta no cadastro e do
-- acréscimo por marketplace (ONE-257, ONE-258, ONE-259, 24/11/2026).
-- Aplicar junto com o deploy do código.
insert into public.novidades (titulo, texto, link, link_rotulo)
values
  (
    'Os custos da marca agora ficam no Financeiro',
    'Custos fixos, salário, peças vendidas por mês, imposto e taxa de recebimento são preenchidos uma vez, na aba Custos da marca. A Calculadora do cadastro pede só os custos da peça e o lucro, e segue o Tipo, que ganhou Encomenda (sob medida).',
    '/financeiro#custos-da-marca',
    'Preencher os custos da marca'
  ),
  (
    'O preço de cada marketplace aparece no cadastro',
    'Em Marketplaces, cada canal ganha um acréscimo no preço, como 40% no Mercado Livre. O cadastro do produto mostra o preço de cada canal pra pôr no anúncio, e a Loja da marca fica com o preço sem acréscimo.',
    '/produtos/anuncios',
    'Cadastrar o acréscimo'
  );
