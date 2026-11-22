-- Novidade do sino (regra de 29/10): paleta de cores na Vitrine online e a
-- ordem da vitrine também em Produtos. Aplicar só junto com o deploy.

insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Paleta de cores na Vitrine online',
  'A loja ganhou uma paleta de cores: a cliente escolhe a cor do produto por amostra, e o pedido chega com a cor escrita. A paleta fica em Vitrine online; em Produtos, cada produto diz se usa a paleta, e o botão "Ordem na vitrine" muda quem aparece primeiro.',
  '/catalogo',
  'Montar a paleta'
);
