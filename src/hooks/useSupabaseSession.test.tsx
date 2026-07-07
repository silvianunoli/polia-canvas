import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";

const { onAuthStateChangeMock, getSessionMock, maybeSingleMock, fromMock } = vi.hoisted(() => ({
  onAuthStateChangeMock: vi.fn(),
  getSessionMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
      getSession: getSessionMock,
    },
    from: fromMock,
  },
}));

// import depois do mock, pra garantir que o módulo mockado seja o resolvido
const { useSupabaseSession, resolvePostLoginPath } = await import("./useSupabaseSession");

const fakeSession = { user: { id: "user-1" } } as unknown as Session;

function setupAuthMocks({
  initialSession = null as Session | null,
  // undefined = onAuthStateChange não emite nada de imediato (fiel ao Supabase
  // real, que dispara de forma assíncrona) — só quem hidrata é getSession().
  emitOnSubscribe = undefined as Session | null | undefined,
} = {}) {
  const unsubscribe = vi.fn();
  onAuthStateChangeMock.mockImplementation((cb: (event: string, session: Session | null) => void) => {
    if (emitOnSubscribe !== undefined) cb("INITIAL", emitOnSubscribe);
    return { data: { subscription: { unsubscribe } } };
  });
  getSessionMock.mockResolvedValue({ data: { session: initialSession } });
  return { unsubscribe };
}

describe("useSupabaseSession", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("começa em loading: true e session: null", async () => {
    setupAuthMocks();
    const { result } = renderHook(() => useSupabaseSession());
    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();

    // drena a promise de getSession() pendente, senão ela resolve depois do
    // fim do teste e vaza um "not wrapped in act(...)" pro teste seguinte.
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("hidrata session e loading: false a partir de supabase.auth.getSession()", async () => {
    setupAuthMocks({ initialSession: fakeSession });
    const { result } = renderHook(() => useSupabaseSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBe(fakeSession);
    expect(result.current.user).toBe(fakeSession.user);
  });

  it("user é null quando não há sessão", async () => {
    setupAuthMocks({ initialSession: null });
    const { result } = renderHook(() => useSupabaseSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("atualiza a sessão quando onAuthStateChange emite um evento (ex.: login em outra aba)", async () => {
    setupAuthMocks({ initialSession: null, emitOnSubscribe: fakeSession });
    const { result } = renderHook(() => useSupabaseSession());

    await waitFor(() => expect(result.current.session).toBe(fakeSession));
  });

  it("cancela a inscrição do listener ao desmontar", () => {
    const { unsubscribe } = setupAuthMocks();
    const { unmount } = renderHook(() => useSupabaseSession());

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("resolvePostLoginPath", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockProfileQuery(data: { onboarding_completed: boolean } | null, throwError = false) {
    maybeSingleMock.mockImplementation(async () => {
      if (throwError) throw new Error("falha de rede");
      return { data };
    });
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }),
      }),
    });
  }

  it("retorna /painel quando onboarding_completed é true", async () => {
    mockProfileQuery({ onboarding_completed: true });
    expect(await resolvePostLoginPath("user-1")).toBe("/painel");
  });

  it("retorna /onboarding quando onboarding_completed é false", async () => {
    mockProfileQuery({ onboarding_completed: false });
    expect(await resolvePostLoginPath("user-1")).toBe("/onboarding");
  });

  it("retorna /onboarding quando o profile não existe ainda (data: null)", async () => {
    mockProfileQuery(null);
    expect(await resolvePostLoginPath("user-1")).toBe("/onboarding");
  });

  it("retorna /onboarding (fail-safe) quando a query lança exceção", async () => {
    mockProfileQuery(null, true);
    expect(await resolvePostLoginPath("user-1")).toBe("/onboarding");
  });
});
