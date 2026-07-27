import { describe, it, expect } from "vitest";
import {
  calcularTaxas,
  calcularQuantoSobra,
  calcularSobraPct,
  calcularPrecoSugerido,
  calcularEncomenda,
  taxasDoBreakdown,
  type EncomendaInput,
} from "./precificacao.functions";

describe("calcularPrecoSugerido", () => {
  it("com só taxa+imposto (sem margem) dá o piso — preço mínimo sem lucro", () => {
    const piso = calcularPrecoSugerido(100, 10); // 10% de taxa+imposto, sem margem
    expect(piso).toBeCloseTo(111.11, 2);
  });

  it("com taxa+imposto+margem dá o preço sugerido, sempre >= o piso", () => {
    const piso = calcularPrecoSugerido(100, 10);
    const sugerido = calcularPrecoSugerido(100, 10 + 20); // + 20% de margem
    expect(sugerido).toBeGreaterThan(piso);
    expect(sugerido).toBeCloseTo(100 / 0.7, 5); // 100 / (1 - 0.30)
  });

  it("retorna o próprio custo quando os percentuais somam 100% ou mais (evita divisão por zero/negativa)", () => {
    expect(calcularPrecoSugerido(100, 100)).toBe(100);
    expect(calcularPrecoSugerido(100, 150)).toBe(100);
  });
});

describe("calcularEncomenda", () => {
  function base(overrides: Partial<EncomendaInput> = {}): EncomendaInput {
    return {
      itensMaterial: [],
      horas: 0,
      valorHora: 0,
      itensExtras: [],
      taxaVendaPct: 0,
      impostosPct: 0,
      quantoSobraPct: 0,
      ...overrides,
    };
  }

  it("soma vários materiais (quantidade x custo unitário), trabalho e extras no custo total", () => {
    const r = calcularEncomenda(
      base({
        itensMaterial: [
          { quantidade: 2, custoUnitario: 8 }, // 16
          { quantidade: 1, custoUnitario: 30 }, // 30
        ],
        horas: 3,
        valorHora: 25, // 75
        itensExtras: [{ valor: 10 }, { valor: 5 }], // 15
      }),
    );
    expect(r.custoMaterial).toBe(46);
    expect(r.custoTrabalho).toBe(75);
    expect(r.custoExtras).toBe(15);
    expect(r.custoTotal).toBe(136);
  });

  it("o piso bate com o custo total inflado só por taxa+imposto (sem a margem desejada)", () => {
    const r = calcularEncomenda(
      base({
        itensMaterial: [{ quantidade: 1, custoUnitario: 100 }],
        taxaVendaPct: 5,
        impostosPct: 5,
        quantoSobraPct: 30,
      }),
    );
    // custoTotal = 100; piso = 100 / (1 - 0.10) = 111.11...
    expect(r.piso).toBeCloseTo(100 / 0.9, 5);
    expect(r.precoSugerido).toBeGreaterThan(r.piso);
  });

  it("quantoSobraPct negativo derruba o preço sugerido abaixo do piso (prejuízo)", () => {
    const r = calcularEncomenda(
      base({
        itensMaterial: [{ quantidade: 1, custoUnitario: 100 }],
        taxaVendaPct: 5,
        impostosPct: 5,
        quantoSobraPct: -20,
      }),
    );
    expect(r.precoSugerido).toBeLessThan(r.piso);
  });

  it("sem valor-hora definido, horas não entram no custo (custoTrabalho = 0)", () => {
    const r = calcularEncomenda(base({ horas: 4, valorHora: 0 }));
    expect(r.custoTrabalho).toBe(0);
  });

  it("encomenda totalmente vazia não quebra e devolve tudo zerado", () => {
    const r = calcularEncomenda(base());
    expect(r.custoTotal).toBe(0);
    expect(r.piso).toBe(0);
    expect(r.precoSugerido).toBe(0);
  });
});

describe("taxasDoBreakdown", () => {
  it("lê taxaVendaE/impostosE do breakdown de perfil 'encomenda'", () => {
    const r = taxasDoBreakdown({
      perfil: "encomenda",
      valores: { taxaVendaE: "5", impostosE: "6" },
    });
    expect(r).toEqual({ taxaVendaPct: 5, impostosPct: 6 });
  });

  it("continua lendo taxaVenda/impostos do perfil 'produto' (regressão)", () => {
    const r = taxasDoBreakdown({
      perfil: "produto",
      valores: { taxaVenda: "3", impostos: "4" },
    });
    expect(r).toEqual({ taxaVendaPct: 3, impostosPct: 4 });
  });

  it("continua lendo taxaVendaS/impostosS do perfil 'servico' (regressão)", () => {
    const r = taxasDoBreakdown({
      perfil: "servico",
      valores: { taxaVendaS: "7", impostosS: "8" },
    });
    expect(r).toEqual({ taxaVendaPct: 7, impostosPct: 8 });
  });

  it("devolve zero quando não há breakdown", () => {
    expect(taxasDoBreakdown(null)).toEqual({ taxaVendaPct: 0, impostosPct: 0 });
  });
});

describe("calcularTaxas / calcularQuantoSobra / calcularSobraPct (regressão)", () => {
  it("calculam consistentemente pra um caso simples conhecido", () => {
    const input = { precoVenda: 100, precoCusto: 50, taxaVendaPct: 5, impostosPct: 5 };
    expect(calcularTaxas(input)).toBe(10);
    expect(calcularQuantoSobra(input)).toBe(40);
    expect(calcularSobraPct(input)).toBe(40);
  });
});
