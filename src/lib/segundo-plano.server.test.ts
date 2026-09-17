import { describe, expect, it, vi } from "vitest";
import { comContextoDeExecucao, drenarSegundoPlano, emSegundoPlano } from "./segundo-plano.server";

describe("emSegundoPlano", () => {
  it("passa a tarefa pro waitUntil do contexto quando existe", async () => {
    const waitUntil = vi.fn();
    await comContextoDeExecucao({ waitUntil }, async () => {
      await Promise.resolve();
      emSegundoPlano(Promise.resolve("ok"));
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("não quebra fora de contexto nem com tarefa rejeitada", async () => {
    expect(() => emSegundoPlano(Promise.reject(new Error("x")))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("drena a fila global pro waitUntil quando não havia contexto", async () => {
    const waitUntil = vi.fn();
    emSegundoPlano(Promise.resolve("solta"));
    drenarSegundoPlano({ waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    drenarSegundoPlano({ waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("ignora contexto sem waitUntil", async () => {
    const resultado = await comContextoDeExecucao({}, async () => 42);
    expect(resultado).toBe(42);
  });
});
