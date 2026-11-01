-- Busca por nome na aba Catálogo de Produtos (ONE-164). Aplicar só depois do deploy.
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('Busca por nome em Produtos',
   'A aba Catálogo de Produtos ganhou o campo "Buscar pelo nome": digite parte do nome e a lista mostra só os produtos que batem, sem diferença de maiúscula ou acento.',
   '/produtos', 'Abrir Produtos');
