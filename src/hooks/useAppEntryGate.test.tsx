import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";

const { navigateMock, isNativeAppMock, useSupabaseSessionMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  isNativeAppMock: vi.fn(),
  useSupabaseSessionMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: navigateMock }),
}));
vi.mock("@/lib/platform", () => ({ isNativeApp: isNativeAppMock }));
vi.mock("@/hooks/useSupabaseSession", () => ({ useSupabaseSession: useSupabaseSessionMock }));

const { useAppEntryGate } = await import("./useAppEntryGate");

function sessao({ user = null as { id: string } | null, loading = false } = {}) {
  useSupabaseSessionMock.mockReturnValue({ user, loading, session: user ? { user } : null });
}

describe("useAppEntryGate", () => {
  beforeEach(() => {
    isNativeAppMock.mockReturnValue(false);
    sessao();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("no site (web)", () => {
    it("não esconde a Home nem redireciona, mesmo sem sessão", () => {
      const { result } = renderHook(() => useAppEntryGate());
      expect(result.current.escondendoHome).toBe(false);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("não redireciona quem já está logada", () => {
      sessao({ user: { id: "u1" } });
      renderHook(() => useAppEntryGate());
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  describe("no app (Capacitor)", () => {
    beforeEach(() => {
      isNativeAppMock.mockReturnValue(true);
    });

    it("sem sessão, manda pra tela de entrada do app (replace) e esconde a Home", () => {
      const { result } = renderHook(() => useAppEntryGate());
      expect(navigateMock).toHaveBeenCalledWith({ to: "/app", replace: true });
      expect(result.current.escondendoHome).toBe(true);
    });

    // Não pode mandar pra /app quem ainda pode estar logada.
    it("enquanto a sessão carrega, esconde a Home e não redireciona", () => {
      sessao({ loading: true });
      const { result } = renderHook(() => useAppEntryGate());
      expect(result.current.escondendoHome).toBe(true);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("com sessão, manda direto pra aba Hoje (replace)", () => {
      sessao({ user: { id: "u1" } });
      renderHook(() => useAppEntryGate());
      expect(navigateMock).toHaveBeenCalledWith({ to: "/hoje", replace: true });
    });

    // SSR assume web: o Capacitor só é consultado depois do mount.
    it("só consulta o Capacitor depois do mount (nunca durante o render)", () => {
      renderHook(() => useAppEntryGate());
      expect(isNativeAppMock).toHaveBeenCalledTimes(1);
    });
  });
});
