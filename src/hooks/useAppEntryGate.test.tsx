import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

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

const DISMISS_KEY = "polia-app-entry-gate-dismissed";

function sessao({ user = null as { id: string } | null, loading = false } = {}) {
  useSupabaseSessionMock.mockReturnValue({ user, loading, session: user ? { user } : null });
}

describe("useAppEntryGate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    isNativeAppMock.mockReturnValue(false);
    sessao();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("no site (web)", () => {
    it("nunca mostra o modal nem esconde a Home, mesmo sem sessão", () => {
      const { result } = renderHook(() => useAppEntryGate());
      expect(result.current.mostrarModal).toBe(false);
      expect(result.current.escondendoHome).toBe(false);
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

    it("mostra o modal 'já é usuária?' pra quem não tem sessão", () => {
      const { result } = renderHook(() => useAppEntryGate());
      expect(result.current.mostrarModal).toBe(true);
      expect(result.current.escondendoHome).toBe(false);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    // Não pode piscar marketing antes de saber se vai redirecionar.
    it("enquanto a sessão carrega, esconde a Home e não mostra o modal", () => {
      sessao({ loading: true });
      const { result } = renderHook(() => useAppEntryGate());
      expect(result.current.escondendoHome).toBe(true);
      expect(result.current.mostrarModal).toBe(false);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it("com sessão, manda direto pro painel (replace) e esconde a Home", () => {
      sessao({ user: { id: "u1" } });
      const { result } = renderHook(() => useAppEntryGate());
      expect(navigateMock).toHaveBeenCalledWith({ to: "/painel", replace: true });
      expect(result.current.escondendoHome).toBe(true);
      expect(result.current.mostrarModal).toBe(false);
    });

    it("não mostra o modal de novo se já foi dispensado nesta abertura do app", () => {
      sessionStorage.setItem(DISMISS_KEY, "1");
      const { result } = renderHook(() => useAppEntryGate());
      expect(result.current.mostrarModal).toBe(false);
    });

    it("explorar() dispensa o modal e guarda em sessionStorage", () => {
      const { result } = renderHook(() => useAppEntryGate());
      expect(result.current.mostrarModal).toBe(true);
      act(() => result.current.explorar());
      expect(result.current.mostrarModal).toBe(false);
      expect(sessionStorage.getItem(DISMISS_KEY)).toBe("1");
    });

    // SSR assume web: o Capacitor só é consultado depois do mount.
    it("só consulta o Capacitor depois do mount (nunca durante o render)", () => {
      renderHook(() => useAppEntryGate());
      expect(isNativeAppMock).toHaveBeenCalledTimes(1);
    });
  });
});
