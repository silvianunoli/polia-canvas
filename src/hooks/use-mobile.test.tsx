import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

function setInnerWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
}

// jsdom não implementa matchMedia — mockamos e guardamos o listener "change"
// registrado pelo hook pra poder disparar manualmente nos testes.
function mockMatchMedia() {
  let changeListener: (() => void) | undefined;
  const mql = {
    matches: false,
    media: "",
    addEventListener: vi.fn((event: string, cb: () => void) => {
      if (event === "change") changeListener = cb;
    }),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    triggerChange: () => act(() => changeListener?.()),
    mql,
  };
}

describe("useIsMobile", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("retorna true quando innerWidth está abaixo do breakpoint (768px)", () => {
    setInnerWidth(500);
    mockMatchMedia();
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("retorna false quando innerWidth está no breakpoint ou acima", () => {
    setInnerWidth(1024);
    mockMatchMedia();
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("nunca retorna undefined (começa desconhecido mas o hook força boolean)", () => {
    setInnerWidth(1024);
    mockMatchMedia();
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe("boolean");
  });

  it("reage ao evento 'change' da media query (ex.: redimensionar a janela)", () => {
    setInnerWidth(1024);
    const { triggerChange } = mockMatchMedia();
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setInnerWidth(400);
    triggerChange();
    expect(result.current).toBe(true);
  });

  it("remove o listener de 'change' ao desmontar", () => {
    setInnerWidth(1024);
    const { mql } = mockMatchMedia();
    const { unmount } = renderHook(() => useIsMobile());

    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
