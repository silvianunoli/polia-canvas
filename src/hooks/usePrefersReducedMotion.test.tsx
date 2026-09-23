import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// jsdom não implementa matchMedia: mockamos e guardamos o listener "change".
function mockMatchMedia(matches: boolean) {
  let changeListener: (() => void) | undefined;
  const mql = {
    matches,
    media: "",
    addEventListener: vi.fn((event: string, cb: () => void) => {
      if (event === "change") changeListener = cb;
    }),
    removeEventListener: vi.fn(),
  };
  const matchMedia = vi.fn().mockReturnValue(mql);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    mql,
    matchMedia,
    mudarPara: (novo: boolean) => {
      mql.matches = novo;
      act(() => changeListener?.());
    },
  };
}

describe("usePrefersReducedMotion", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("consulta a media query de prefers-reduced-motion", () => {
    const { matchMedia } = mockMatchMedia(false);
    renderHook(() => usePrefersReducedMotion());
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("é false quando o sistema não pede menos movimento", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("é true quando o sistema pede menos movimento", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reage quando a preferência muda com a página aberta", () => {
    const { mudarPara } = mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    mudarPara(true);
    expect(result.current).toBe(true);
    mudarPara(false);
    expect(result.current).toBe(false);
  });

  it("remove o listener ao desmontar", () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
