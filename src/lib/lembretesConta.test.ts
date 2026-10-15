import { describe, expect, it } from "vitest";
import {
  lembreteDeConfirmacao,
  montarEmailConfirmacao,
  type TipoLembrete,
} from "../../supabase/functions/_shared/lembretesConta.ts";

const HORA = 60 * 60 * 1000;
const agora = new Date("2026-10-14T12:00:00Z");
const ha = (horas: number) => new Date(agora.getTime() - horas * HORA);
const nada = new Set<TipoLembrete>();

describe("lembreteDeConfirmacao", () => {
  it("nada antes de 1 hora", () => {
    expect(lembreteDeConfirmacao(ha(0.5), agora, nada)).toBeNull();
  });
  it("1h entre 1 e 24 horas, uma vez só", () => {
    expect(lembreteDeConfirmacao(ha(2), agora, nada)).toBe("confirmacao_1h");
    expect(lembreteDeConfirmacao(ha(2), agora, new Set(["confirmacao_1h"]))).toBeNull();
  });
  it("24h entre 24 horas e 7 dias, mesmo sem ter recebido o de 1h", () => {
    expect(lembreteDeConfirmacao(ha(30), agora, nada)).toBe("confirmacao_24h");
    expect(lembreteDeConfirmacao(ha(30), agora, new Set(["confirmacao_1h"]))).toBe(
      "confirmacao_24h",
    );
    expect(lembreteDeConfirmacao(ha(30), agora, new Set(["confirmacao_24h"]))).toBeNull();
  });
  it("nada depois de 7 dias", () => {
    expect(lembreteDeConfirmacao(ha(24 * 8), agora, nada)).toBeNull();
  });
});

describe("montarEmailConfirmacao", () => {
  it("leva o link no botão e no texto puro, sem travessão nem exclamação", () => {
    for (const tipo of ["confirmacao_1h", "confirmacao_24h"] as const) {
      const e = montarEmailConfirmacao(tipo, "https://exemplo.com/link?x=1");
      expect(e.texto).toContain("https://exemplo.com/link?x=1");
      expect(e.html).toContain("Confirmar e entrar");
      expect(`${e.assunto} ${e.texto}`).not.toMatch(/[—–!]/);
    }
  });
  it("assuntos diferentes pros dois lembretes", () => {
    expect(montarEmailConfirmacao("confirmacao_1h", "x").assunto).not.toBe(
      montarEmailConfirmacao("confirmacao_24h", "x").assunto,
    );
  });
});
