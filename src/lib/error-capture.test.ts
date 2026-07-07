import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { consumeLastCapturedError } from "./error-capture";

// O módulo registra os listeners de "error"/"unhandledrejection" no globalThis
// assim que é importado (top-level), então cada teste dispara o evento e lê o
// resultado — sem precisar reimportar o módulo.

function dispatchError(error: unknown) {
  const event = new ErrorEvent("error", { error });
  globalThis.dispatchEvent(event);
}

function dispatchUnhandledRejection(reason: unknown) {
  // jsdom não implementa PromiseRejectionEvent nativamente; construímos um
  // Event e anexamos `reason`, do mesmo jeito que o código de produção lê.
  const event = new Event("unhandledrejection") as unknown as PromiseRejectionEvent;
  Object.defineProperty(event, "reason", { value: reason, configurable: true });
  globalThis.dispatchEvent(event);
}

describe("consumeLastCapturedError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // drena qualquer captura deixada por um teste anterior
    consumeLastCapturedError();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna undefined quando nenhum erro foi capturado", () => {
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("captura o erro de um evento 'error' global", () => {
    const err = new Error("falha no render");
    dispatchError(err);
    expect(consumeLastCapturedError()).toBe(err);
  });

  it("captura o motivo de um evento 'unhandledrejection'", () => {
    const reason = new Error("promise rejeitada");
    dispatchUnhandledRejection(reason);
    expect(consumeLastCapturedError()).toBe(reason);
  });

  it("consome uma única vez: a segunda leitura retorna undefined", () => {
    dispatchError(new Error("x"));
    consumeLastCapturedError();
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("expira após 5s: erro não consumido a tempo vira undefined", () => {
    dispatchError(new Error("velho"));
    vi.advanceTimersByTime(5_001);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("não expira exatamente dentro da janela de 5s", () => {
    dispatchError(new Error("ainda válido"));
    vi.advanceTimersByTime(4_999);
    expect(consumeLastCapturedError()).toBeDefined();
  });

  it("uma captura nova sobrescreve a anterior ainda não consumida", () => {
    const antigo = new Error("antigo");
    const novo = new Error("novo");
    dispatchError(antigo);
    dispatchError(novo);
    expect(consumeLastCapturedError()).toBe(novo);
  });
});
