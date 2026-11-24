-- Novidade (sino): Loja da marca com nome e logo próprios e o Envio da loja no menu.
-- Só a conta com loja da marca vê essas telas, mas o aviso vai pra todas as contas
-- como as outras novidades; por isso o texto também diz onde o Suporte foi parar,
-- que vale pra todo mundo. Entra junto com o deploy do código.
insert into public.novidades (titulo, texto, link, link_rotulo)
values (
  'Suporte no menu e Configurações mais enxuta',
  'O Suporte ganhou lugar no menu lateral, logo abaixo de Configurações, e continua no botão do topo, agora com o Rever o tour. As integrações dos marketplaces ficam só em Marketplaces. Quem tem loja da marca ajusta o nome, o logo e o envio na própria Loja da marca.',
  '/chamados',
  'Abrir o Suporte'
);
