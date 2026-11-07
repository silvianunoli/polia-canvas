-- HIG-24: "Registrar venda →" saiu de Clientes no ONE-183 (commit c89b025), porque
-- lançava em dobro a venda que já tinha entrado pelo quadro de Pedidos. A função
-- ficou no banco por causa de aba aberta com o app antigo. Conferido em 07/11 antes
-- de tirar: nenhuma cliente marcada e nenhum lançamento dela desde o deploy, e
-- nenhuma outra função ou objeto depende dela. A coluna clientes.venda_registrada
-- fica: o selo "Registrada" das clientes já marcadas e o CSV ainda leem.
drop function if exists public.registrar_venda_cliente(uuid);
