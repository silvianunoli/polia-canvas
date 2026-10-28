import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CartaoPedido } from "./CartaoPedido";
import type { PedidoLinha } from "./dados";

afterEach(() => cleanup());

const HOJE = "2026-10-28";

const pedido = (over: Partial<PedidoLinha> = {}): PedidoLinha => ({
  id: "v1",
  canal: "encomenda",
  data: HOJE,
  status: "a_receber",
  clienteId: null,
  clienteNome: "Joana",
  subtotal: 36,
  desconto: 0,
  frete: 0,
  taxaCanal: 0,
  custoEnvio: 0,
  total: 36,
  observacao: null,
  itens: [
    {
      produtoId: "p1",
      produtoNome: "Bolo de pote",
      variacao: null,
      quantidade: 2,
      precoUnitario: 18,
      custoUnitario: 11,
    },
  ],
  andamento: "a_fazer",
  entregaEm: "2026-10-30",
  ...over,
});

function montar(p: PedidoLinha) {
  const props = {
    onAvancar: vi.fn(),
    onAbrir: vi.fn(),
    onReceber: vi.fn(),
    onDragStart: vi.fn(),
  };
  render(
    <ul>
      <CartaoPedido pedido={p} hoje={HOJE} ocupado={false} {...props} />
    </ul>,
  );
  return props;
}

describe("CartaoPedido (GRW-93)", () => {
  it("mostra cliente, itens, total, lucro, entrega e pagamento", () => {
    montar(pedido());
    expect(screen.getByText("Joana")).toBeTruthy();
    expect(screen.getByText("2x Bolo de pote")).toBeTruthy();
    expect(screen.getByText(/lucra/).textContent).toMatch(/14/);
    expect(screen.getByText("entrega sex 30/10")).toBeTruthy();
    expect(screen.getByText("a receber")).toBeTruthy();
  });

  it("avisa o atraso e avança pra próxima coluna", async () => {
    const props = montar(pedido({ entregaEm: "2026-10-27" }));
    expect(screen.getByText("atrasado desde 27/10")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Mover pedido de Joana pra Em produção" }),
    );
    expect(props.onAvancar).toHaveBeenCalledTimes(1);
  });

  it("entregue a receber pergunta se o dinheiro entrou; Ainda não esconde a pergunta", async () => {
    const props = montar(pedido({ andamento: "entregue" }));
    expect(screen.getByText("Entregue. O dinheiro já entrou?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Sim, lançar no Financeiro" }));
    expect(props.onReceber).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Ainda não" }));
    expect(screen.queryByText("Entregue. O dinheiro já entrou?")).toBeNull();
  });

  it("entregue e pago não pergunta nem avança", () => {
    montar(pedido({ andamento: "entregue", status: "recebida" }));
    expect(screen.queryByText("Entregue. O dinheiro já entrou?")).toBeNull();
    expect(screen.queryByRole("button", { name: /Mover pedido/ })).toBeNull();
  });
});
