import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useCaptchaPronto } from "./useCaptchaPronto";

describe("useCaptchaPronto", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("com token, está pronto", () => {
    const { result } = renderHook(() => useCaptchaPronto({ token: "t", pedidoDeReset: 0 }));
    expect(result.current).toBe(true);
  });

  it("sem token, espera; libera quando o token chega", () => {
    const { result, rerender } = renderHook((p) => useCaptchaPronto(p), {
      initialProps: { token: null as string | null, pedidoDeReset: 1 },
    });
    expect(result.current).toBe(false);
    rerender({ token: "novo", pedidoDeReset: 1 });
    expect(result.current).toBe(true);
  });

  it("widget bloqueado: libera depois da espera máxima", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCaptchaPronto({ token: null, pedidoDeReset: 1 }, 8000));
    expect(result.current).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current).toBe(true);
  });

  it("um reset novo volta a esperar no mesmo render", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook((p) => useCaptchaPronto(p, 8000), {
      initialProps: { token: null as string | null, pedidoDeReset: 1 },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current).toBe(true);
    rerender({ token: null, pedidoDeReset: 2 });
    expect(result.current).toBe(false);
  });
});
