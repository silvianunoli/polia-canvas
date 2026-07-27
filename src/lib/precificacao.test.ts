import { describe, it, expect } from "vitest";
import {
  calcularTaxas,
  calcularQuantoSobra,
  calcularSobraPct,
  calcularPrecoSugerido,
} from "./precificacao.functions";

describe("calcularTaxas", () => {
  it("é zero sem taxa nem imposto", () => {
    expect(calcularTaxas({ precoVenda: 100, precoCusto: 0 })).toBe(0);
  });

  it("soma taxa de venda e imposto, os dois como % do preço", () => {
    expect(calcularTaxas({ precoVenda: 100, precoCusto: 0, taxaVendaPct: 5, impostosPct: 6 })).toBe(11);
  });

  it("é zero quando o preço é zero ou negativo", () => {
    expect(calcularTaxas({ precoVenda: 0, precoCusto: 0, taxaVendaPct: 10 })).toBe(0);
    expect(calcularTaxas({ precoVenda: -10, precoCusto: 0, taxaVendaPct: 10 })).toBe(0);
  });
});

describe("calcularQuantoSobra", () => {
  it("é preço menos custo quando não tem taxa nem imposto", () => {
    expect(calcularQuantoSobra({ precoVenda: 50, precoCusto: 20 })).toBe(30);
  });

  it("desconta taxa e imposto do preço antes de subtrair o custo", () => {
    // preço 45.76, custo 27, taxa 5% + imposto 6% = 11% de 45.76 = 5.0336
    const sobra = calcularQuantoSobra({ precoVenda: 45.76, precoCusto: 27, taxaVendaPct: 5, impostosPct: 6 });
    expect(sobra).toBeCloseTo(13.7264, 4);
  });

  it("é zero quando o preço é zero", () => {
    expect(calcularQuantoSobra({ precoVenda: 0, precoCusto: 20 })).toBe(0);
  });
});

describe("calcularSobraPct", () => {
  it("calcula a % do preço que sobra, arredondada", () => {
    expect(calcularSobraPct({ precoVenda: 50, precoCusto: 20 })).toBe(60);
  });

  it("nunca fica negativa mesmo com prejuízo", () => {
    expect(calcularSobraPct({ precoVenda: 50, precoCusto: 80 })).toBe(0);
  });

  it("é zero quando o preço é zero", () => {
    expect(calcularSobraPct({ precoVenda: 0, precoCusto: 20 })).toBe(0);
  });
});

describe("calcularPrecoSugerido", () => {
  it("aplica a fórmula 'por dentro' (custo / (1 - pct/100))", () => {
    expect(calcularPrecoSugerido(27, 41)).toBeCloseTo(45.7627, 4);
  });

  it("cai pro custo puro quando os percentuais somam 100% ou mais", () => {
    expect(calcularPrecoSugerido(27, 100)).toBe(27);
    expect(calcularPrecoSugerido(27, 130)).toBe(27);
  });
});
