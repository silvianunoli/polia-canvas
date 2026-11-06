-- Aviso da véspera (ONE-174). Aplicar junto com o deploy (regra do sino).
insert into public.novidades (titulo, texto, link, link_rotulo) values
  ('A Pólia One avisa das entregas de amanhã',
   'Às 18h da véspera, a Pólia One manda um e-mail com os pedidos que têm entrega no dia seguinte e ainda não foram entregues. Sem entrega amanhã, não sai nada. Dá pra desligar em Configurações, em Notificações.',
   '/pedidos', 'Abrir os Pedidos');
