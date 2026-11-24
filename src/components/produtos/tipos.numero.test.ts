import { describe, expect, it } from "vitest";
import { normalizarDigitado, num, numInvalido, numPos } from "./tipos";

// Revisão de 24/11/2026: o campo era type="number" e "1.500" virava R$ 1,50.
const ler = (digitado: string) => num(normalizarDigitado(digitado));

describe("normalizarDigitado + num (valor digitado no jeito brasileiro)", () => {
  it("ponto de milhar não vira decimal", () => {
    expect(ler("1.500")).toBe(1500);
    expect(ler("12.000")).toBe(12000);
    expect(ler("1.234.567")).toBe(1234567);
  });

  it("vírgula é o decimal, com ou sem milhar", () => {
    expect(ler("12,50")).toBe(12.5);
    expect(ler("1.500,50")).toBe(1500.5);
  });

  it("ponto que não forma milhar continua decimal", () => {
    expect(ler("1.5")).toBe(1.5);
    expect(ler("12.50")).toBe(12.5);
    expect(ler("0.500")).toBe(0.5);
  });

  it("tira R$ e espaço", () => {
    expect(ler("R$ 1.500")).toBe(1500);
  });

  it("número que já estava salvo (texto do navegador) lê igual", () => {
    expect(ler("37.5")).toBe(37.5);
    expect(ler("1500")).toBe(1500);
  });
});

describe("numInvalido", () => {
  it("vazio não é erro", () => {
    expect(numInvalido("")).toBe(false);
  });
  it("texto e número quebrado são erro", () => {
    expect(numInvalido("abc")).toBe(true);
    expect(numInvalido("12,5abc")).toBe(true);
    expect(numInvalido("1.2.3")).toBe(true);
  });
  it("negativo é erro, menos onde é permitido (lucro)", () => {
    expect(numInvalido("-10")).toBe(true);
    expect(numInvalido("-10", true)).toBe(false);
  });
  it("número normal passa", () => {
    expect(numInvalido("12,5")).toBe(false);
    expect(numInvalido("12.5")).toBe(false);
  });
});

describe("numPos", () => {
  it("custo negativo não baixa a conta", () => {
    expect(numPos("-10")).toBe(0);
    expect(numPos("10")).toBe(10);
  });
});
