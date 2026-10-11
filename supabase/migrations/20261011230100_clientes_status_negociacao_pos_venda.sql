-- ONE-123 (feedback de teste, 11/10/2026): status antes do pedido
-- (negociação) e depois da entrega (pós-venda). Os quatro antigos ficam,
-- então nenhuma linha existente quebra. Lista igual a src/lib/statusCliente.ts.
alter table public.clientes
  drop constraint if exists clientes_status_pedido_check;

alter table public.clientes
  add constraint clientes_status_pedido_check
  check (status_pedido = any (array[
    'Primeiro contato'::text,
    'Orçamento enviado'::text,
    'Pensando'::text,
    'Em espera'::text,
    'Em produção'::text,
    'Atrasado'::text,
    'Entregue'::text,
    'Pós-venda'::text
  ]));
