-- "Registrar venda →" saiu da lista de Clientes (ONE-183). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('A venda agora entra por Pedidos ou pela ficha da cliente',
   'O botão "Registrar venda" saiu da lista de Clientes, porque podia lançar em dobro uma venda que já tinha entrado por Pedidos. O status da cliente segue organizando a lista, e a ficha dela continua registrando venda.',
   '/pedidos', 'Abrir Pedidos');
