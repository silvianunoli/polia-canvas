import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// "Banco" de mentira: a coluna dicas_vistas da usuária.
const banco = vi.hoisted(() => ({ dicas: [] as string[], updates: [] as string[][] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { dicas_vistas: [...banco.dicas] }, error: null }),
        }),
      }),
      update: (v: { dicas_vistas: string[] }) => ({
        eq: async () => {
          banco.updates.push(v.dicas_vistas);
          banco.dicas = [...v.dicas_vistas];
          return { error: null };
        },
      }),
    }),
  },
}));

vi.mock("@/hooks/useSupabaseSession", () => ({
  useSupabaseSession: () => ({ user: { id: "u1" }, loading: false }),
}));

const { useDicasVistas } = await import("./useDicasVistas");

function criarWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useDicasVistas com duas abas (QA-25)", () => {
  afterEach(() => {
    cleanup();
    banco.dicas = [];
    banco.updates = [];
  });

  it("marcar numa aba não apaga o que a outra aba gravou depois que esta leu", async () => {
    banco.dicas = [];
    const { result } = renderHook(() => useDicasVistas(), { wrapper: criarWrapper() });
    await waitFor(() => expect(result.current.pronto).toBe(true));
    expect(result.current.mostrar("tour")).toBe(true);

    // Outra aba dispensa o tour enquanto esta continua com a lista velha.
    banco.dicas = ["tour"];

    act(() => result.current.marcar("produtos"));
    // Some sem esperar o banco gravar.
    await waitFor(() => expect(result.current.mostrar("produtos")).toBe(false));

    await waitFor(() => expect(banco.updates.length).toBe(1));
    expect(banco.updates[0]).toEqual(["tour", "produtos"]);
    await waitFor(() => expect(result.current.mostrar("tour")).toBe(false));
  });

  it("duas marcações seguidas na mesma aba gravam as duas", async () => {
    const { result } = renderHook(() => useDicasVistas(), { wrapper: criarWrapper() });
    await waitFor(() => expect(result.current.pronto).toBe(true));
    act(() => {
      result.current.marcar("tutorial");
      result.current.marcar("tour");
    });
    await waitFor(() => expect(banco.updates.length).toBe(2));
    expect(banco.dicas).toEqual(["tutorial", "tour"]);
  });

  it("esquecer (Rever o tour) tira só a chave pedida", async () => {
    banco.dicas = ["tour", "produtos"];
    const { result } = renderHook(() => useDicasVistas(), { wrapper: criarWrapper() });
    await waitFor(() => expect(result.current.pronto).toBe(true));
    banco.dicas = ["tour", "produtos", "metas"];
    act(() => result.current.esquecer("tour"));
    await waitFor(() => expect(banco.updates.length).toBe(1));
    expect(banco.dicas).toEqual(["produtos", "metas"]);
  });
});
