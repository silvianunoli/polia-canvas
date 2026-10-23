import { describe, it, expect, vi } from "vitest";
import { recarregarSeVersaoAntiga } from "./versao-antiga";

function memoria() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("recarregarSeVersaoAntiga", () => {
  it("recarrega na primeira falha", () => {
    const recarregar = vi.fn();
    expect(recarregarSeVersaoAntiga(memoria(), recarregar, 1_000)).toBe(true);
    expect(recarregar).toHaveBeenCalledOnce();
  });

  it("não recarrega de novo dentro de 30s (evita loop)", () => {
    const s = memoria();
    const recarregar = vi.fn();
    recarregarSeVersaoAntiga(s, recarregar, 1_000);
    expect(recarregarSeVersaoAntiga(s, recarregar, 20_000)).toBe(false);
    expect(recarregar).toHaveBeenCalledOnce();
  });

  it("volta a recarregar depois da janela", () => {
    const s = memoria();
    const recarregar = vi.fn();
    recarregarSeVersaoAntiga(s, recarregar, 1_000);
    expect(recarregarSeVersaoAntiga(s, recarregar, 40_000)).toBe(true);
    expect(recarregar).toHaveBeenCalledTimes(2);
  });

  it("sem sessionStorage utilizável não recarrega", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {},
    };
    const recarregar = vi.fn();
    expect(recarregarSeVersaoAntiga(quebrado, recarregar)).toBe(false);
    expect(recarregarSeVersaoAntiga(undefined, recarregar)).toBe(false);
    expect(recarregar).not.toHaveBeenCalled();
  });
});
