import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { useCapsLockWarning } from "./useCapsLockWarning";

function eventoTeclado(capsLock: boolean | undefined) {
  return {
    getModifierState:
      capsLock === undefined ? undefined : (tecla: string) => tecla === "CapsLock" && capsLock,
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe("useCapsLockWarning", () => {
  afterEach(() => {
    cleanup();
  });

  it("começa desligado", () => {
    const { result } = renderHook(() => useCapsLockWarning());
    expect(result.current.ligado).toBe(false);
  });

  it("liga quando o evento diz que Caps Lock está ativo", () => {
    const { result } = renderHook(() => useCapsLockWarning());
    act(() => result.current.onKeyUp(eventoTeclado(true)));
    expect(result.current.ligado).toBe(true);
  });

  // Hint, não erro: some sozinho quando a tecla desliga.
  it("desliga sozinho no próximo keyup sem Caps Lock", () => {
    const { result } = renderHook(() => useCapsLockWarning());
    act(() => result.current.onKeyUp(eventoTeclado(true)));
    act(() => result.current.onKeyUp(eventoTeclado(false)));
    expect(result.current.ligado).toBe(false);
  });

  it("ignora evento sem getModifierState (navegador antigo) sem explodir", () => {
    const { result } = renderHook(() => useCapsLockWarning());
    act(() => result.current.onKeyUp(eventoTeclado(true)));
    expect(() => act(() => result.current.onKeyUp(eventoTeclado(undefined)))).not.toThrow();
    expect(result.current.ligado).toBe(true);
  });
});
