import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { eqMock, selectMock, fromMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { eqMock, selectMock, fromMock };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: fromMock } }));

const { useCamposPlanejamento } = await import("./useCamposPlanejamento");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCamposPlanejamento", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("não consulta nada sem userId (query desabilitada)", () => {
    const { result } = renderHook(() => useCamposPlanejamento(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("lê planejamento_campos da usuária e devolve um Map campo -> valor", async () => {
    eqMock.mockResolvedValue({
      data: [
        { campo: "nome_marca", valor: "Doces da Ana" },
        { campo: "publico", valor: "mães de crianças pequenas" },
      ],
    });
    const { result } = renderHook(() => useCamposPlanejamento("u1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fromMock).toHaveBeenCalledWith("planejamento_campos");
    expect(selectMock).toHaveBeenCalledWith("campo, valor");
    expect(eqMock).toHaveBeenCalledWith("user_id", "u1");
    expect(result.current.data).toEqual(
      new Map([
        ["nome_marca", "Doces da Ana"],
        ["publico", "mães de crianças pequenas"],
      ]),
    );
  });

  // Campo vazio no KV não pode "preencher" a tela com string em branco.
  it("descarta campos com valor null ou só espaços", async () => {
    eqMock.mockResolvedValue({
      data: [
        { campo: "a", valor: null },
        { campo: "b", valor: "   " },
        { campo: "c", valor: "ok" },
      ],
    });
    const { result } = renderHook(() => useCamposPlanejamento("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(new Map([["c", "ok"]]));
  });

  it("data null vira Map vazio", async () => {
    eqMock.mockResolvedValue({ data: null });
    const { result } = renderHook(() => useCamposPlanejamento("u1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(new Map());
  });
});
