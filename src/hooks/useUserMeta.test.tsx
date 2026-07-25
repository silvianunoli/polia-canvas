import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

const { onAuthStateChangeMock, getSessionMock, fromMock } = vi.hoisted(() => ({
  onAuthStateChangeMock: vi.fn(),
  getSessionMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { onAuthStateChange: onAuthStateChangeMock, getSession: getSessionMock },
    from: fromMock,
  },
}));

const { useUserMeta } = await import("./useUserMeta");

const fakeSession = { user: { id: "user-1", user_metadata: {} } } as unknown as Session;

// Builder de mock "postgrest-like": select/eq/gte/limit encadeiam e retornam a si
// mesmo; o objeto inteiro é thenable (resolve como se fosse `await` direto na
// query, do jeito que tarefas/presencas são lidos no hook real).
function chainResolvingTo(value: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve),
  };
  return chain;
}

function chainWithMaybeSingle(value: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(value)),
  };
  return chain;
}

interface MockData {
  profile?: { full_name?: string; is_admin?: boolean; business_name?: string } | null;
  tarefas?: { status: string; updated_at: string }[];
  presencas?: { data: string }[];
}

function setupSupabaseMocks({ profile = null, tarefas = [], presencas = [] }: MockData = {}) {
  onAuthStateChangeMock.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
  getSessionMock.mockResolvedValue({ data: { session: fakeSession } });

  const upsertMock = vi.fn(() => Promise.resolve({ error: null }));

  fromMock.mockImplementation((table: string) => {
    if (table === "profiles") return chainWithMaybeSingle({ data: profile });
    if (table === "tarefas") return chainResolvingTo({ data: tarefas });
    if (table === "presencas") {
      // presencas serve duas finalidades no hook: upsert (registrar presença de
      // hoje) e select (ler o histórico) — o mesmo mock precisa responder às duas.
      const selectChain = chainResolvingTo({ data: presencas });
      return { ...selectChain, upsert: upsertMock };
    }
    throw new Error(`tabela não mockada: ${table}`);
  });

  return { upsertMock };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useUserMeta", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("retorna os valores de fallback (P/você/streak 0) antes da query resolver", async () => {
    setupSupabaseMocks({ profile: { full_name: "Ana Silva" } });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    expect(result.current).toEqual({
      initial: "P",
      displayName: "você",
      businessName: null,
      isAdmin: false,
      streak: 0,
      avatarUrl: null,
    });

    // drena a query pendente, senão ela resolve depois do fim do teste e vaza
    // um "not wrapped in act(...)" pro teste seguinte.
    await waitFor(() => expect(result.current.displayName).toBe("Ana"));
  });

  it("resolve displayName com o primeiro nome e initial em maiúscula", async () => {
    setupSupabaseMocks({ profile: { full_name: "Ana Silva" } });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.displayName).toBe("Ana"));
    expect(result.current.initial).toBe("A");
  });

  it("usa 'você'/'P' quando o profile não tem full_name nem user_metadata", async () => {
    setupSupabaseMocks({ profile: {} });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.streak).toBeDefined());
    expect(result.current.displayName).toBe("você");
    expect(result.current.initial).toBe("P");
  });

  it("propaga isAdmin: true a partir do profile", async () => {
    setupSupabaseMocks({ profile: { full_name: "Ana", is_admin: true } });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.isAdmin).toBe(true));
  });

  it("businessName vira null quando vazio ou só espaços em branco", async () => {
    setupSupabaseMocks({ profile: { full_name: "Ana", business_name: "   " } });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.displayName).toBe("Ana"));
    expect(result.current.businessName).toBeNull();
  });

  it("businessName é o valor com espaços nas pontas removidos", async () => {
    setupSupabaseMocks({ profile: { full_name: "Ana", business_name: "  Ateliê da Ana  " } });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.businessName).toBe("Ateliê da Ana"));
  });

  it("streak conta dias distintos, deduplicando data repetida entre presença e tarefa", async () => {
    setupSupabaseMocks({
      profile: { full_name: "Ana" },
      presencas: [{ data: "2026-07-01" }, { data: "2026-07-02" }],
      tarefas: [{ status: "concluido", updated_at: "2026-07-02T10:00:00Z" }], // mesmo dia -> não conta 2x
    });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.streak).toBe(2)); // 07-01, 07-02
  });

  it("streak ignora tarefa com status diferente de 'concluido' (já vem filtrado, mas a soma não deve contar duplicidade indevida)", async () => {
    setupSupabaseMocks({
      profile: { full_name: "Ana" },
      tarefas: [{ status: "concluido", updated_at: "2026-07-03T10:00:00Z" }],
    });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.streak).toBe(1));
  });

  // Regressão: o vocabulário de tarefa concluída já foi "floresceu" (mundo jardim,
  // revertido em 2026-05-30). Um "concluido" com status desatualizado não deve
  // nunca mais silenciosamente parar de contar pra presença.
  it("streak não conta tarefa com o vocabulário antigo 'floresceu'", async () => {
    setupSupabaseMocks({
      profile: { full_name: "Ana" },
      tarefas: [{ status: "floresceu", updated_at: "2026-07-03T10:00:00Z" }],
    });
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(result.current.displayName).toBe("Ana"));
    expect(result.current.streak).toBe(0);
  });

  it("registra presença de hoje via upsert idempotente (onConflict user_id,data)", async () => {
    const { upsertMock } = setupSupabaseMocks({ profile: { full_name: "Ana" } });
    renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1" }),
      { onConflict: "user_id,data", ignoreDuplicates: true },
    );
  });

  it("fica no fallback e não dispara a query quando não há usuário logado", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    onAuthStateChangeMock.mockImplementation(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }));
    const { result } = renderHook(() => useUserMeta(), { wrapper });

    await waitFor(() => expect(fromMock).not.toHaveBeenCalled());
    expect(result.current.displayName).toBe("você");
  });
});
