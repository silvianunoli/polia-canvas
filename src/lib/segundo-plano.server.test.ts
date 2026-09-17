import { describe, expect, it, vi } from "vitest";
import {
  comContextoDeExecucao,
  drenarSegundoPlano,
  emSegundoPlano,
  resolverContextoDeExecucao,
} from "./segundo-plano.server";

describe("resolverContextoDeExecucao", () => {
  it("usa o ctx direto quando ele tem waitUntil", () => {
    const waitUntil = vi.fn();
    const execucao = resolverContextoDeExecucao(new Request("https://x/"), { waitUntil });
    execucao?.waitUntil(Promise.resolve());
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("cai no waitUntil pendurado na Request pelo Nitro", () => {
    const waitUntil = vi.fn();
    const req = Object.assign(new Request("https://x/"), { waitUntil });
    const execucao = resolverContextoDeExecucao(req, undefined);
    execucao?.waitUntil(Promise.resolve());
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("cai no runtime.cloudflare.context da Request", () => {
    const waitUntil = vi.fn();
    const req = Object.assign(new Request("https://x/"), {
      runtime: { cloudflare: { context: { waitUntil } } },
    });
    const execucao = resolverContextoDeExecucao(req, undefined);
    execucao?.waitUntil(Promise.resolve());
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("devolve null sem contexto", () => {
    expect(resolverContextoDeExecucao(new Request("https://x/"), undefined)).toBeNull();
  });
});

describe("emSegundoPlano", () => {
  it("passa a tarefa pro waitUntil do contexto quando existe", async () => {
    const waitUntil = vi.fn();
    await comContextoDeExecucao({ waitUntil }, async () => {
      await Promise.resolve();
      emSegundoPlano(Promise.resolve("ok"));
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("drena a fila global pro waitUntil quando não havia contexto", async () => {
    const waitUntil = vi.fn();
    emSegundoPlano(Promise.resolve("solta"));
    drenarSegundoPlano({ waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    drenarSegundoPlano({ waitUntil });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("não quebra fora de contexto nem com tarefa rejeitada", async () => {
    expect(() => emSegundoPlano(Promise.reject(new Error("x")))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    drenarSegundoPlano(null);
  });

  it("roda a função mesmo sem contexto", async () => {
    const resultado = await comContextoDeExecucao(null, async () => 42);
    expect(resultado).toBe(42);
  });
});
