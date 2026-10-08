import { describe, expect, it } from "vitest";
import { formatarReais, percentualDe } from "./formatarReais";

describe("formatarReais", () => {
  it("valor redondo sai sem centavos", () => {
    expect(formatarReais(44)).toBe("R$ 44");
    expect(formatarReais(12345)).toBe("R$ 12.345");
  });

  it("com centavos, sempre duas casas (antes saía R$ 44,1 ou R$ 44)", () => {
    expect(formatarReais(44.1)).toBe("R$ 44,10");
    expect(formatarReais(29.9)).toBe("R$ 29,90");
    expect(formatarReais(1234.5)).toBe("R$ 1.234,50");
  });

  it("negativo leva o sinal antes do símbolo", () => {
    expect(formatarReais(-0.4)).toBe("-R$ 0,40");
    expect(formatarReais(-50)).toBe("-R$ 50");
  });

  it("o que arredonda pra zero nunca vira R$ -0", () => {
    expect(formatarReais(0)).toBe("R$ 0");
    expect(formatarReais(-0)).toBe("R$ 0");
    expect(formatarReais(-0.004)).toBe("R$ 0");
  });

  it("ruído de ponto flutuante não vira centavo", () => {
    expect(formatarReais(0.1 + 0.2)).toBe("R$ 0,30");
    expect(formatarReais(100.00000001)).toBe("R$ 100");
  });

  it("valor inválido não quebra a tela", () => {
    expect(formatarReais(Number.NaN)).toBe("R$ 0");
  });
});

describe("percentualDe", () => {
  it("mostra o negativo quando saiu mais do que entrou", () => {
    expect(percentualDe(-50, 100)).toBe(-50);
  });

  it("arredonda pro inteiro", () => {
    expect(percentualDe(1, 3)).toBe(33);
  });

  it("sem total positivo, 0", () => {
    expect(percentualDe(10, 0)).toBe(0);
    expect(percentualDe(10, -5)).toBe(0);
  });

  it("nunca devolve -0", () => {
    expect(Object.is(percentualDe(-0.1, 100), 0)).toBe(true);
  });
});
