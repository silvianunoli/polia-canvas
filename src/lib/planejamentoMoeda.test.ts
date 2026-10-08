import { describe, it, expect } from "vitest";
import {
  MAX_DIGITOS_REAIS,
  limparMoedaDigitada,
  normalizarMoeda,
  posicaoDoCursor,
} from "./planejamentoMoeda";

// Simula digitar tecla por tecla num campo controlado: cada tecla entra no
// fim do que já está na tela e passa pela limpeza.
function digitar(teclas: string, inicial = ""): string {
  let v = inicial;
  for (const t of teclas) v = limparMoedaDigitada(v + t);
  return v;
}

describe("limparMoedaDigitada (QA-15)", () => {
  it("digitar 3000 tecla por tecla é R$ 3.000, não R$ 30,00", () => {
    expect(digitar("3000")).toBe("R$ 3000");
    expect(normalizarMoeda(digitar("3000"))).toBe("R$ 3.000,00");
  });

  it("colar 3000, R$ 3.000 e 1.234,5", () => {
    expect(normalizarMoeda(limparMoedaDigitada("3000"))).toBe("R$ 3.000,00");
    expect(normalizarMoeda(limparMoedaDigitada("R$ 3.000"))).toBe("R$ 3.000,00");
    expect(normalizarMoeda(limparMoedaDigitada("1.234,5"))).toBe("R$ 1.234,50");
    expect(normalizarMoeda(limparMoedaDigitada("R$ 1.234.567,89"))).toBe("R$ 1.234.567,89");
  });

  it("ponto com até 2 casas no fim é decimal (teclado de celular só com ponto)", () => {
    expect(normalizarMoeda("49.90")).toBe("R$ 49,90");
    expect(normalizarMoeda("1234.5")).toBe("R$ 1.234,50");
    expect(digitar("49.9")).toBe("R$ 49,9");
  });

  it("vírgula digitada fica na tela esperando os centavos", () => {
    expect(digitar("12,")).toBe("R$ 12,");
    expect(digitar("12,5")).toBe("R$ 12,5");
    expect(digitar("12,555")).toBe("R$ 12,55");
  });

  it("Backspace consegue deixar o campo vazio", () => {
    let v = "R$ 3000";
    while (v) v = limparMoedaDigitada(v.slice(0, -1));
    expect(v).toBe("");
    expect(limparMoedaDigitada("R$ ")).toBe("");
    expect(limparMoedaDigitada("R$")).toBe("");
  });

  it("apagar no valor que veio do banco não vira centavo", () => {
    // "R$ 3.000,00" salvo; Backspace no fim.
    expect(limparMoedaDigitada("R$ 3.000,0")).toBe("R$ 3000,0");
    expect(normalizarMoeda("R$ 3.000,0")).toBe("R$ 3.000,00");
  });

  it("números enormes param no teto de dígitos", () => {
    const v = digitar("12345678901234567890");
    expect(v).toBe(`R$ ${"1234567890".slice(0, MAX_DIGITOS_REAIS)}`);
    expect(normalizarMoeda(v)).toBe("R$ 1.234.567.890,00");
  });

  it("zero à esquerda some e letra é ignorada", () => {
    expect(limparMoedaDigitada("R$ 05")).toBe("R$ 5");
    expect(limparMoedaDigitada("R$ 3000 por mês")).toBe("R$ 3000");
    expect(limparMoedaDigitada("abc")).toBe("");
  });

  it("formato antigo do banco continua lido igual", () => {
    expect(normalizarMoeda("R$ 30,00")).toBe("R$ 30,00");
    expect(normalizarMoeda("R$ 1.500,00")).toBe("R$ 1.500,00");
  });
});

describe("posicaoDoCursor", () => {
  it("editar no meio de um valor com ponto de milhar mantém o cursor no dígito", () => {
    // "R$ 1.234,50", cursor depois do "2", digita "9": "R$ 1.2934,50".
    const digitado = "R$ 1.2934,50";
    const limpo = limparMoedaDigitada(digitado); // "R$ 12934,50"
    const pos = posicaoDoCursor(digitado, 7, limpo);
    expect(limpo.slice(0, pos)).toBe("R$ 129");
  });

  it("primeiro dígito num campo vazio vai pro fim", () => {
    expect(posicaoDoCursor("3", 1, "R$ 3")).toBe(4);
  });

  it("logo depois da vírgula digitada, fica depois dela", () => {
    expect(posicaoDoCursor("R$ 12.", 6, "R$ 12,")).toBe(6);
  });
});
