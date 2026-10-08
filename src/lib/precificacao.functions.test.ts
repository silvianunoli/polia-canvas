import { describe, it, expect } from "vitest";
import {
  calcularTaxas,
  calcularQuantoSobra,
  calcularSobraPct,
  calcularPrecoSugerido,
  calcularEncomenda,
  taxasDoBreakdown,
  simularDesconto,
  sobraDoProduto,
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

describe("simularDesconto (QA-26)", () => {
  // Caderno A5 da landing: preço 49, custo 26,95, maquininha 5%.
  const base = { precoVenda: 49, precoCusto: 26.95, taxaVendaPct: 5, impostosPct: 0 };

  it("desconto pequeno: preço cai, taxa cai junto, sobra positiva sem prejuízo", () => {
    const r = simularDesconto({ ...base, descontoPct: 15 })!;
    expect(r.precoComDesconto).toBeCloseTo(41.65, 2);
    // 41,65 - 26,95 - 5% de 41,65 (2,0825) = 12,6175
    expect(r.sobra).toBeCloseTo(12.6175, 4);
    expect(r.prejuizo).toBe(false);
  });

  it("desconto que passa do custo dá prejuízo (bate com a frase da landing, 45%)", () => {
    const r = simularDesconto({ ...base, descontoPct: 45 })!;
    expect(r.precoComDesconto).toBeCloseTo(26.95, 2);
    expect(r.sobra).toBeCloseTo(-1.3475, 4);
    expect(r.prejuizo).toBe(true);
  });

  it("100% de desconto: preço zero, o custo inteiro vira prejuízo (antes dava sobra 0 sem aviso)", () => {
    const r = simularDesconto({ ...base, descontoPct: 100 })!;
    expect(r.precoComDesconto).toBe(0);
    expect(r.sobra).toBeCloseTo(-26.95, 2);
    expect(r.prejuizo).toBe(true);
  });

  it("mais de 100%: preço não fica negativo e o prejuízo continua sendo o custo", () => {
    const r = simularDesconto({ ...base, descontoPct: 150 })!;
    expect(r.precoComDesconto).toBe(0);
    expect(r.sobra).toBeCloseTo(-26.95, 2);
    expect(r.prejuizo).toBe(true);
  });

  it("desconto vazio, zero ou negativo não simula", () => {
    expect(simularDesconto({ ...base, descontoPct: 0 })).toBeNull();
    expect(simularDesconto({ ...base, descontoPct: -10 })).toBeNull();
    expect(simularDesconto({ ...base, descontoPct: Number.NaN })).toBeNull();
  });

  it("sobra que arredonda pra zero centavo não é prejuízo", () => {
    const r = simularDesconto({
      precoVenda: 100,
      precoCusto: 50.004,
      descontoPct: 50,
    })!;
    expect(r.prejuizo).toBe(false);
  });
});

describe("sobraDoProduto (QA-27)", () => {
  it("devolve valor e % com sinal quando o produto dá prejuízo (calcularSobraPct escondia em 0%)", () => {
    const r = sobraDoProduto({ precoVenda: 50, precoCusto: 80, breakdown: null })!;
    expect(r.valor).toBe(-30);
    expect(r.pct).toBe(-60);
    expect(r.pctBarra).toBe(0);
    expect(r.prejuizo).toBe(true);
    // a função antiga continua presa em 0 (é só pra barra)
    expect(calcularSobraPct({ precoVenda: 50, precoCusto: 80 })).toBe(0);
  });

  it("caso normal bate com calcularQuantoSobra, com taxa do breakdown", () => {
    const r = sobraDoProduto({
      precoVenda: 100,
      precoCusto: 50,
      breakdown: { perfil: "produto", valores: { taxaVenda: "5", impostos: "5" } },
    })!;
    expect(r.valor).toBe(40);
    expect(r.pct).toBe(40);
    expect(r.pctBarra).toBe(40);
    expect(r.prejuizo).toBe(false);
  });

  it("sem custo cadastrado não inventa custo zero: devolve null", () => {
    expect(sobraDoProduto({ precoVenda: 49, precoCusto: null, breakdown: null })).toBeNull();
  });

  it("sem preço de venda (produto do Planejamento, 'preço a definir') devolve null", () => {
    expect(sobraDoProduto({ precoVenda: 0, precoCusto: 10, breakdown: null })).toBeNull();
  });

  it("custo zero cadastrado é custo conhecido (não é o mesmo que sem custo)", () => {
    const r = sobraDoProduto({ precoVenda: 30, precoCusto: 0, breakdown: null })!;
    expect(r.valor).toBe(30);
    expect(r.pct).toBe(100);
  });
});
