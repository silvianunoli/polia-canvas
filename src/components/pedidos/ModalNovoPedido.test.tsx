import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnchorHTMLAttributes } from "react";

const refetch = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...rest} />
  ),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      }),
    }),
  },
}));
vi.mock("@/components/vendas/dados", () => ({
  chaveEstoque: (userId: string) => ["estoque", userId],
  useProdutosComEstoque: () => ({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch,
  }),
}));
vi.mock("@/components/vendas/ModalRegistrarVenda", () => ({ ItemDaVenda: () => null }));
vi.mock("@/components/produtos/ModalProduto", () => ({
  ModalProduto: ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => (
    <div>
      <p>Cadastro do produto</p>
      <button type="button" onClick={onClose}>
        Fechar o cadastro
      </button>
      <button type="button" onClick={onSaved}>
        Salvar o cadastro
      </button>
    </div>
  ),
}));
vi.mock("./dados", () => ({ registrarPedido: vi.fn() }));

const { ModalNovoPedido } = await import("./ModalNovoPedido");

afterEach(() => cleanup());

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidar = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <ModalNovoPedido userId="u1" onClose={vi.fn()} onSaved={vi.fn()} />
    </QueryClientProvider>,
  );
  return { invalidar };
}

describe("ModalNovoPedido com o catálogo vazio (ONE-175)", () => {
  it("o caminho principal é cadastrar o produto, e a Calculadora fica como link menor", () => {
    montar();
    expect(screen.getByRole("button", { name: "Cadastrar o produto" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "A Calculadora faz a conta" })).toBeTruthy();
    expect(screen.queryByText("Calcular o preço do primeiro produto")).toBeNull();
  });

  it("cadastrar abre o produto ali mesmo; salvar atualiza o catálogo e volta pro pedido", async () => {
    const { invalidar } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar o produto" }));
    expect(screen.getByText("Cadastro do produto")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Salvar o cadastro" }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["estoque", "u1"] });
    expect(screen.queryByText("Cadastro do produto")).toBeNull();
    expect(screen.getByRole("heading", { name: "Novo pedido" })).toBeTruthy();
  });

  it("cancelar o cadastro volta pro pedido sem atualizar nada", async () => {
    const { invalidar } = montar();
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar o produto" }));
    await userEvent.click(screen.getByRole("button", { name: "Fechar o cadastro" }));
    expect(invalidar).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cadastrar o produto" })).toBeTruthy();
  });
});
