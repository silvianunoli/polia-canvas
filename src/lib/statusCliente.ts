// Status da cliente em Clientes (ONE-123, feedback de teste de 11/10/2026).
// Antes só existiam os quatro do pedido; quem tem cliente que demora pra
// decidir não tinha onde marcar a negociação, nem onde acompanhar o depois
// da entrega. A ordem da lista é a ordem do caminho da cliente.
//
// O texto é gravado como está em clientes.status_pedido (check
// clientes_status_pedido_check), então mudar um rótulo aqui pede migration.

export const STATUS_NEGOCIACAO = ["Primeiro contato", "Orçamento enviado", "Pensando"] as const;
export const STATUS_PEDIDO = ["Em espera", "Em produção", "Atrasado", "Entregue"] as const;
export const STATUS_DEPOIS = ["Pós-venda"] as const;

export type StatusCliente =
  | (typeof STATUS_NEGOCIACAO)[number]
  | (typeof STATUS_PEDIDO)[number]
  | (typeof STATUS_DEPOIS)[number];

export const GRUPOS_STATUS: { titulo: string; status: readonly StatusCliente[] }[] = [
  { titulo: "Antes do pedido", status: STATUS_NEGOCIACAO },
  { titulo: "Pedido", status: STATUS_PEDIDO },
  { titulo: "Depois da entrega", status: STATUS_DEPOIS },
];

export const TODOS_STATUS: StatusCliente[] = GRUPOS_STATUS.flatMap((g) => g.status);

/** Pedido já entregue: conta como entregue no Painel e libera registrar a venda. */
export function jaEntregue(status: string | null | undefined): boolean {
  return status === "Entregue" || status === "Pós-venda";
}

export function emNegociacao(status: string | null | undefined): boolean {
  return (STATUS_NEGOCIACAO as readonly string[]).includes(status ?? "");
}
