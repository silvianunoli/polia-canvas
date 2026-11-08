import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { ler, acao } = vi.hoisted(() => ({ ler: vi.fn(), acao: vi.fn() }));

vi.mock("@/lib/envioLoja.functions", () => ({ lerEtiquetaDoPedido: ler, acaoEtiqueta: acao }));
vi.mock("@/hooks/useSupabaseSession", () => ({
  useSupabaseSession: () => ({ user: { id: "u" } }),
}));
vi.mock("./dados", () => ({ recarregarDepoisDoPedido: vi.fn() }));

import { EtiquetaDoPedido } from "./EtiquetaDoPedido";

const VENDA = "aaaaaaaa-0000-4000-8000-000000000001";
const base = {
  servico: ".Package",
  empresa: "Jadlog",
  freteCobrado: 23.45,
  destino: "Belo Horizonte/MG",
  status: null,
  custo: null,
  rastreioCodigo: null,
  rastreioUrl: null,
  rastreioStatus: null,
};

function montar(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  ler.mockReset();
  acao.mockReset();
});

describe("EtiquetaDoPedido", () => {
  it("pedido sem frete não mostra nada", async () => {
    ler.mockResolvedValue(null);
    const { container } = montar(<EtiquetaDoPedido vendaId={VENDA} />);
    await waitFor(() => expect(ler).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("comprar primeiro prepara, sem pagar", async () => {
    ler.mockResolvedValue(base);
    acao.mockResolvedValue({ ok: true, error: null, status: "carrinho", custo: 20, saldo: 50 });
    montar(<EtiquetaDoPedido vendaId={VENDA} />);
    fireEvent.click(await screen.findByRole("button", { name: "Comprar etiqueta" }));
    await waitFor(() =>
      expect(acao).toHaveBeenCalledWith({ data: { vendaId: VENDA, acao: "preparar" } }),
    );
    expect(acao).not.toHaveBeenCalledWith({ data: { vendaId: VENDA, acao: "comprar" } });
  });

  it("sem saldo bloqueia o pagamento", async () => {
    ler.mockResolvedValueOnce(base).mockResolvedValue({ ...base, status: "carrinho", custo: 20 });
    acao.mockResolvedValue({ ok: true, error: null, status: "carrinho", custo: 20, saldo: 5 });
    montar(<EtiquetaDoPedido vendaId={VENDA} />);
    fireEvent.click(await screen.findByRole("button", { name: "Comprar etiqueta" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Pagar/ })).toHaveProperty("disabled", true),
    );
    expect(screen.getByRole("alert").textContent).toContain("saldo");
  });

  it("gerada mostra imprimir e pede confirmação para cancelar", async () => {
    ler.mockResolvedValue({ ...base, status: "gerada", custo: 20 });
    montar(<EtiquetaDoPedido vendaId={VENDA} />);
    expect(await screen.findByRole("button", { name: "Imprimir etiqueta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar etiqueta" }));
    expect(acao).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("antes de postar");
  });

  it("postada mostra o rastreio e tira o cancelar", async () => {
    ler.mockResolvedValue({
      ...base,
      status: "gerada",
      custo: 20,
      rastreioStatus: "postada",
      rastreioCodigo: "ME123",
      rastreioUrl: "https://x.com/ME123",
    });
    montar(<EtiquetaDoPedido vendaId={VENDA} />);
    expect((await screen.findByRole("link", { name: "Acompanhar" })).getAttribute("href")).toBe(
      "https://x.com/ME123",
    );
    expect(screen.queryByRole("button", { name: "Cancelar etiqueta" })).toBeNull();
  });

  it("paga sem gerar oferece retomar", async () => {
    ler.mockResolvedValue({ ...base, status: "paga", custo: 20 });
    montar(<EtiquetaDoPedido vendaId={VENDA} />);
    expect(await screen.findByRole("button", { name: "Gerar etiqueta" })).toBeTruthy();
  });

  it("erro do Melhor Envio aparece para a dona", async () => {
    ler.mockResolvedValue(base);
    acao.mockResolvedValue({ ok: false, error: "O Melhor Envio não aceitou a etiqueta." });
    montar(<EtiquetaDoPedido vendaId={VENDA} />);
    fireEvent.click(await screen.findByRole("button", { name: "Comprar etiqueta" }));
    expect((await screen.findByRole("alert")).textContent).toContain("não aceitou");
  });
});
