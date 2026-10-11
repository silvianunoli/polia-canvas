import { describe, expect, it } from "vitest";
import { emNegociacao, GRUPOS_STATUS, jaEntregue, TODOS_STATUS } from "./statusCliente";

describe("statusCliente", () => {
  it("segue a ordem do caminho da cliente, sem repetir", () => {
    expect(TODOS_STATUS).toEqual([
      "Primeiro contato",
      "Orçamento enviado",
      "Pensando",
      "Em espera",
      "Em produção",
      "Atrasado",
      "Entregue",
      "Pós-venda",
    ]);
    expect(new Set(TODOS_STATUS).size).toBe(TODOS_STATUS.length);
    expect(GRUPOS_STATUS.map((g) => g.titulo)).toEqual([
      "Antes do pedido",
      "Pedido",
      "Depois da entrega",
    ]);
  });

  it("pós-venda continua contando como entregue", () => {
    expect(jaEntregue("Entregue")).toBe(true);
    expect(jaEntregue("Pós-venda")).toBe(true);
    expect(jaEntregue("Em produção")).toBe(false);
    expect(jaEntregue("Pensando")).toBe(false);
    expect(jaEntregue(null)).toBe(false);
  });

  it("negociação é só o que vem antes do pedido", () => {
    expect(emNegociacao("Primeiro contato")).toBe(true);
    expect(emNegociacao("Orçamento enviado")).toBe(true);
    expect(emNegociacao("Pensando")).toBe(true);
    expect(emNegociacao("Em espera")).toBe(false);
    expect(emNegociacao(undefined)).toBe(false);
  });
});
