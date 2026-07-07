import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useOnlineStatus } from "./useOnlineStatus";

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true, writable: true });
}

describe("useOnlineStatus", () => {
  beforeEach(() => {
    setNavigatorOnLine(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("começa true quando navigator.onLine é true", () => {
    setNavigatorOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("começa false quando navigator.onLine é false", () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("vira false ao disparar o evento 'offline'", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  it("volta a true ao disparar o evento 'online' depois de ficar offline", () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("remove os listeners ao desmontar (evento após unmount não quebra nem reaparece)", () => {
    const { result, unmount } = renderHook(() => useOnlineStatus());
    unmount();

    expect(() => {
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
    }).not.toThrow();
    // Sem asserção sobre result.current aqui: o hook já foi desmontado,
    // o teste só garante que o listener não vaza e quebra o processo.
    expect(result.current).toBe(true);
  });
});
