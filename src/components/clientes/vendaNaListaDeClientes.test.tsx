import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";

// ONE-183: o status da cliente não lança dinheiro. "Registrar venda →" podia
// lançar em dobro uma venda que já tinha entrado pelo quadro de Pedidos.

const rpc = vi.hoisted(() => vi.fn());
const prefillDaVenda = vi.hoisted(() => vi.fn());
const clientesDoBanco = vi.hoisted(() => ({ lista: [] as Record<string, unknown>[] }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opcoes: unknown) => ({ options: opcoes }),
  Link: ({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...rest} />
  ),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}));
vi.mock("@/lib/leituraPaginada", () => ({
  lerTodasAsPaginas: async () => clientesDoBanco.lista,
}));
vi.mock("@/hooks/useSupabaseSession", () => ({
  useSupabaseSession: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/useUserMeta", () => ({ useUserMeta: () => ({ businessName: "Marca" }) }));
vi.mock("@/components/layout/PaginaLogada", () => ({
  PaginaLogada: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/clientes/dados", () => ({
  useCompradoPorCliente: () => ({ data: undefined, isError: false }),
}));
vi.mock("@/components/clientes/ModalLinkCaptura", () => ({ ModalLinkCaptura: () => null }));
vi.mock("@/components/orcamentos/ModalOrcamento", () => ({ ModalOrcamento: () => null }));
vi.mock("@/components/clientes/FichaCliente", () => ({
  FichaCliente: ({ onRegistrarVenda }: { onRegistrarVenda: () => void }) => (
    <button type="button" onClick={onRegistrarVenda}>
      Registrar venda na ficha
    </button>
  ),
}));
vi.mock("@/components/vendas/ModalRegistrarVenda", () => ({
  ModalRegistrarVenda: ({ prefill }: { prefill: unknown }) => {
    prefillDaVenda(prefill);
    return <p>Formulário de venda</p>;
  },
}));

const { Route } = await import("@/routes/_authenticated/clientes");
const ClientesPage = (Route as unknown as { options: { component: ComponentType } }).options
  .component;

function cliente(extra: Record<string, unknown>) {
  return {
    id: "c1",
    user_id: "u1",
    nome: "Marina Costa",
    contato: null,
    status_pedido: "Entregue",
    notas: null,
    valor: 90,
    produto_id: null,
    created_at: "2026-11-01T12:00:00Z",
    updated_at: null,
    venda_registrada: false,
    origem: null,
    whatsapp: null,
    whatsapp_consentimento_em: null,
    consentimento_origem: null,
    interesse: null,
    novo: false,
    ...extra,
  };
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ClientesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.mockClear();
  prefillDaVenda.mockClear();
});
afterEach(() => cleanup());

describe("venda na lista de Clientes (ONE-183)", () => {
  it.each([
    ["sem produto", { produto_id: null }],
    ["com produto", { produto_id: "p1" }],
    ["em pós-venda", { status_pedido: "Pós-venda" }],
  ])("cliente entregue %s não tem botão que lança venda", async (_caso, extra) => {
    clientesDoBanco.lista = [cliente(extra)];
    montar();

    await screen.findByRole("button", { name: /abrir ficha/ });
    expect(screen.queryByRole("button", { name: /Registrar venda/ })).toBeNull();
    expect(screen.queryByText(/Coloque o valor da venda/)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cliente marcada antes da mudança continua apontando pro Financeiro", async () => {
    clientesDoBanco.lista = [cliente({ venda_registrada: true })];
    montar();

    const link = await screen.findByRole("link", { name: "ver no Financeiro" });
    expect(link.getAttribute("href")).toBe("/financeiro");
  });

  it("a venda da ficha abre o formulário ligada à cliente e não marca a cliente", async () => {
    clientesDoBanco.lista = [cliente({ produto_id: "p1" })];
    montar();

    await userEvent.click(await screen.findByRole("button", { name: /abrir ficha/ }));
    await userEvent.click(screen.getByRole("button", { name: "Registrar venda na ficha" }));

    expect(screen.getByText("Formulário de venda")).toBeTruthy();
    expect(prefillDaVenda).toHaveBeenLastCalledWith({
      clienteId: "c1",
      clienteNome: "Marina Costa",
      produtoId: "p1",
      valor: 90,
    });
  });
});
