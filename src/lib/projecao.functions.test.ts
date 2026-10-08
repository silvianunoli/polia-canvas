import { describe, expect, it } from "vitest";
import {
  acaoDaMeta,
  CATEGORIA_INSUMOS,
  custosFixosDoMes,
  ehCategoriaInsumos,
  insumosDoMes,
  lerValorReais,
  paraCampoReais,
  valorDoCampo,
  custoMedio,
  mediaTaxas,
  montarProjecao,
  proLaboreJaLancado,
  sobraPorVenda,
  ticketMedio,
  vendasParaAlvo,
  vendasParaFaturar,
} from "@/lib/projecao.functions";
import type { LancamentoResumo } from "@/lib/resumoContador.functions";
import type { ProdutoResumo } from "@/lib/projecao.functions";

const lanc = (over: Partial<LancamentoResumo>): LancamentoResumo => ({
  id: "1",
  data: "2026-07-15",
  tipo: "saida",
  categoria: null,
  descricao: null,
  valor: 0,
  ...over,
});

describe("custosFixosDoMes", () => {
  it("soma saídas do mês, excluindo Pró-labore", () => {
    const lancamentos = [
      lanc({ categoria: "Marketing", valor: 100 }),
      lanc({ categoria: "Pró-labore", valor: 2000 }),
      lanc({ categoria: "Insumos", valor: 50 }),
    ];
    expect(custosFixosDoMes(lancamentos, 7, 2026)).toBe(150);
  });

  it("ignora entradas e lançamentos de outro mês", () => {
    const lancamentos = [
      lanc({ tipo: "entrada", valor: 500 }),
      lanc({ data: "2026-06-15", categoria: "Marketing", valor: 999 }),
      lanc({ categoria: "Marketing", valor: 100 }),
    ];
    expect(custosFixosDoMes(lancamentos, 7, 2026)).toBe(100);
  });

  it("deixa de fora a categoria padrão de insumo (já está no custo de cada produto)", () => {
    const lancamentos = [
      lanc({ categoria: "Marketing", valor: 100 }),
      lanc({ categoria: CATEGORIA_INSUMOS, valor: 1000 }),
      lanc({ categoria: "  insumos / ESTOQUE ", valor: 200 }),
    ];
    expect(custosFixosDoMes(lancamentos, 7, 2026)).toBe(100);
    expect(insumosDoMes(lancamentos, 7, 2026)).toBe(1200);
  });

  it("categoria livre com outro nome continua contando (limitação conhecida)", () => {
    const lancamentos = [
      lanc({ categoria: "Insumos", valor: 50 }),
      lanc({ categoria: "Papel", valor: 30 }),
    ];
    expect(custosFixosDoMes(lancamentos, 7, 2026)).toBe(80);
    expect(insumosDoMes(lancamentos, 7, 2026)).toBe(0);
  });

  it("insumosDoMes ignora entrada e outro mês", () => {
    const lancamentos = [
      lanc({ tipo: "entrada", categoria: CATEGORIA_INSUMOS, valor: 500 }),
      lanc({ data: "2026-06-15", categoria: CATEGORIA_INSUMOS, valor: 999 }),
    ];
    expect(insumosDoMes(lancamentos, 7, 2026)).toBe(0);
  });
});

describe("ehCategoriaInsumos", () => {
  it("bate só com o chip padrão, sem ligar pra caixa e espaço", () => {
    expect(ehCategoriaInsumos("Insumos / estoque")).toBe(true);
    expect(ehCategoriaInsumos(" INSUMOS / ESTOQUE")).toBe(true);
    expect(ehCategoriaInsumos("Insumos")).toBe(false);
    expect(ehCategoriaInsumos(null)).toBe(false);
    expect(ehCategoriaInsumos("")).toBe(false);
  });
});

describe("ponto de empate com insumo (exemplo do caderno)", () => {
  it("R$ 600 de fixos + R$ 1.000 de insumo, sobra R$ 19,60: 31 vendas, não 82", () => {
    const lancamentos = [
      lanc({ categoria: "Ferramentas e assinaturas", valor: 600 }),
      lanc({ categoria: CATEGORIA_INSUMOS, valor: 1000 }),
    ];
    const custosFixos = custosFixosDoMes(lancamentos, 7, 2026);
    expect(custosFixos).toBe(600);
    const projecao = montarProjecao({
      custosFixos,
      proLaboreDesejado: 0,
      metaAlvo: null,
      ticketMedio: 49,
      sobra: 19.6,
    });
    expect(projecao!.empatar.vendas).toBe(31);
    // A conta antiga (insumo somado nos fixos) dava 82.
    expect(vendasParaAlvo(1600, 19.6)).toBe(82);
  });
});

describe("proLaboreJaLancado", () => {
  it("soma só a categoria Pró-labore do mês", () => {
    const lancamentos = [
      lanc({ categoria: "Pró-labore", valor: 1500 }),
      lanc({ categoria: "Pró-labore", valor: 500 }),
      lanc({ categoria: "Marketing", valor: 100 }),
    ];
    expect(proLaboreJaLancado(lancamentos, 7, 2026)).toBe(2000);
  });

  it("retorna 0 quando não há pró-labore lançado", () => {
    expect(proLaboreJaLancado([lanc({ categoria: "Marketing", valor: 100 })], 7, 2026)).toBe(0);
  });
});

const produto = (over: Partial<ProdutoResumo>): ProdutoResumo => ({
  precoVenda: 100,
  precoCusto: 40,
  calculadora_breakdown: null,
  ...over,
});

describe("ticketMedio / custoMedio / mediaTaxas", () => {
  it("retorna 0 pra lista vazia", () => {
    expect(ticketMedio([])).toBe(0);
    expect(custoMedio([])).toBe(0);
    expect(mediaTaxas([])).toEqual({ taxaVendaPct: 0, impostosPct: 0 });
  });

  it("ignora produto sem preço de venda (arquivado/inválido)", () => {
    const produtos = [produto({ precoVenda: 100 }), produto({ precoVenda: 0 })];
    expect(ticketMedio(produtos)).toBe(100);
  });

  it("calcula média simples de preço e custo", () => {
    const produtos = [
      produto({ precoVenda: 100, precoCusto: 40 }),
      produto({ precoVenda: 200, precoCusto: 60 }),
    ];
    expect(ticketMedio(produtos)).toBe(150);
    expect(custoMedio(produtos)).toBe(50);
  });

  it("trata custo nulo como 0 na média", () => {
    const produtos = [produto({ precoCusto: null }), produto({ precoCusto: 20 })];
    expect(custoMedio(produtos)).toBe(10);
  });

  it("calcula média de taxas do breakdown", () => {
    const produtos = [
      produto({
        calculadora_breakdown: { perfil: "produto", valores: { taxaVenda: "10", impostos: "4" } },
      }),
      produto({
        calculadora_breakdown: { perfil: "produto", valores: { taxaVenda: "20", impostos: "6" } },
      }),
    ];
    expect(mediaTaxas(produtos)).toEqual({ taxaVendaPct: 15, impostosPct: 5 });
  });
});

describe("vendasParaAlvo", () => {
  it("arredonda pra cima", () => {
    expect(vendasParaAlvo(1000, 300)).toBe(4);
  });

  it("retorna null quando a sobra é <= 0", () => {
    expect(vendasParaAlvo(1000, 0)).toBeNull();
    expect(vendasParaAlvo(1000, -10)).toBeNull();
  });

  it("retorna 0 quando o alvo é 0 ou negativo", () => {
    expect(vendasParaAlvo(0, 100)).toBe(0);
  });
});

describe("vendasParaFaturar (Meta do mês: divide pelo preço)", () => {
  it("caderno a R$ 49, meta de R$ 3.000: 62 vendas (dividir pela sobra de R$ 19,60 dava 154)", () => {
    expect(vendasParaFaturar(3000, 49)).toBe(62);
    expect(vendasParaAlvo(3000, 19.6)).toBe(154);
  });

  it("arredonda pra cima, sem venda a mais por erro de ponto flutuante", () => {
    expect(vendasParaFaturar(100, 30)).toBe(4);
    expect(vendasParaFaturar(299, 29.9)).toBe(10);
  });

  it("sem preço = null; meta zerada = 0", () => {
    expect(vendasParaFaturar(3000, 0)).toBeNull();
    expect(vendasParaFaturar(3000, -1)).toBeNull();
    expect(vendasParaFaturar(0, 49)).toBe(0);
  });

  it("Projeção e Calculadora dão o mesmo número pro mesmo caso", () => {
    const projecao = montarProjecao({
      custosFixos: 0,
      proLaboreDesejado: 0,
      metaAlvo: 3000,
      ticketMedio: 49,
      sobra: 19.6,
    });
    expect(projecao!.meta!.vendas).toBe(vendasParaFaturar(3000, 49));
  });
});

describe("sobraPorVenda", () => {
  it("usa a mesma lib de precificação (calcularQuantoSobra)", () => {
    expect(
      sobraPorVenda({ ticketMedio: 100, custoMedio: 40, taxaVendaPct: 10, impostosPct: 0 }),
    ).toBe(50);
  });
});

describe("montarProjecao", () => {
  it("calcula empatar, se pagar e meta, conferindo à mão", () => {
    // sobra = 100 - 40 - 10% de 100 = 50 por venda
    const resultado = montarProjecao({
      custosFixos: 1000,
      proLaboreDesejado: 2000,
      metaAlvo: 5000,
      ticketMedio: 100,
      sobra: 50,
    });
    expect(resultado).not.toBeNull();
    expect(resultado!.empatar).toEqual({ vendas: 20, faturamento: 2000 });
    expect(resultado!.sePagar).toEqual({ vendas: 60, faturamento: 6000 });
    // Meta do mês é faturamento (mesma leitura do Painel/Financeiro): divide
    // pelo ticket, não pela sobra — 5000/100 = 50 vendas, faturamento = 5000.
    expect(resultado!.meta).toEqual({ vendas: 50, faturamento: 5000 });
  });

  it("meta divide pelo ticket, não pela sobra", () => {
    const resultado = montarProjecao({
      custosFixos: 0,
      proLaboreDesejado: 0,
      metaAlvo: 3000,
      ticketMedio: 100,
      sobra: 50,
    });
    expect(resultado!.meta).toEqual({ vendas: 30, faturamento: 3000 });
    expect(resultado!.meta).not.toEqual({ vendas: 60, faturamento: 6000 });
  });

  it("retorna meta null quando não há Meta do mês cadastrada", () => {
    const resultado = montarProjecao({
      custosFixos: 1000,
      proLaboreDesejado: 0,
      metaAlvo: null,
      ticketMedio: 100,
      sobra: 50,
    });
    expect(resultado!.meta).toBeNull();
  });

  it("retorna null quando a sobra é <= 0 (erro de negócio)", () => {
    expect(
      montarProjecao({
        custosFixos: 1000,
        proLaboreDesejado: 0,
        metaAlvo: null,
        ticketMedio: 100,
        sobra: 0,
      }),
    ).toBeNull();
  });
});

describe("lerValorReais (QA-29: ponto, vírgula, campo vazio)", () => {
  it("vazio, só espaço ou só 'R$' = null (campo sem valor)", () => {
    expect(lerValorReais("")).toBeNull();
    expect(lerValorReais("   ")).toBeNull();
    expect(lerValorReais("R$ ")).toBeNull();
  });

  it("ponto de milhar do jeito brasileiro (antes '1.500' virava 1,5)", () => {
    expect(lerValorReais("1.500")).toBe(1500);
    expect(lerValorReais("12.345.678")).toBe(12345678);
  });

  it("vírgula decimal", () => {
    expect(lerValorReais("1500,50")).toBe(1500.5);
    expect(lerValorReais("0,5")).toBe(0.5);
    expect(lerValorReais("49,9")).toBe(49.9);
  });

  it("milhar e decimal juntos, nos dois formatos (antes '1.500,50' dava erro)", () => {
    expect(lerValorReais("1.500,50")).toBe(1500.5);
    expect(lerValorReais("R$ 1.500,50")).toBe(1500.5);
    // colado de um valor formatado pelo navegador (espaço não separável depois do R$)
    expect(lerValorReais("R$\u00a01.500,50")).toBe(1500.5);
    expect(lerValorReais("1,500.50")).toBe(1500.5);
  });

  it("um ponto só fora do padrão de milhar é decimal (é como o valor salvo aparecia)", () => {
    expect(lerValorReais("898.57")).toBe(898.57);
    expect(lerValorReais("1.5")).toBe(1.5);
    expect(lerValorReais("0.500")).toBe(0.5);
  });

  it("número inteiro e o próprio formato do campo (paraCampoReais) releem igual", () => {
    expect(lerValorReais("2000")).toBe(2000);
    expect(lerValorReais(paraCampoReais(898.5714285714286))).toBe(898.57);
    expect(lerValorReais(paraCampoReais(1500))).toBe(1500);
  });

  it("texto, negativo e separador ambíguo = NaN (a tela mostra o erro do campo)", () => {
    expect(lerValorReais("abc")).toBeNaN();
    expect(lerValorReais("-100")).toBeNaN();
    expect(lerValorReais("1,500,000")).toBeNaN();
    expect(lerValorReais("1.2.3")).toBeNaN();
    expect(lerValorReais("12,34.5,6")).toBeNaN();
    expect(lerValorReais(".")).toBeNaN();
  });
});

describe("paraCampoReais", () => {
  it("2 casas, vírgula decimal, sem ponto de milhar", () => {
    expect(paraCampoReais(898.5714285714286)).toBe("898,57");
    expect(paraCampoReais(1500)).toBe("1500");
    expect(paraCampoReais(54.5)).toBe("54,5");
  });
});

describe("valorDoCampo", () => {
  it("campo nunca editado usa o valor real", () => {
    expect(valorDoCampo(null, 1234, 0)).toBe(1234);
  });

  it("campo apagado usa o vazio (0 nos custos, null na meta)", () => {
    expect(valorDoCampo("", 1234, 0)).toBe(0);
    expect(valorDoCampo("", 3000, null)).toBeNull();
  });

  it("texto inválido não vira NaN na conta: segura o valor real", () => {
    expect(valorDoCampo("abc", 1234, 0)).toBe(1234);
    expect(valorDoCampo("abc", null, null)).toBeNull();
  });

  it("texto válido em pt-BR entra na conta", () => {
    expect(valorDoCampo("1.500", 0, 0)).toBe(1500);
  });
});

describe("acaoDaMeta (QA-29: o 'salvo' que não salvou)", () => {
  it("sem Meta do mês e com valor digitado: cria (antes só salvava o salário e dizia 'meta salva')", () => {
    expect(acaoDaMeta({ metaId: null, editada: true, valor: 3000 })).toBe("criar");
  });

  it("com Meta do mês e valor digitado: atualiza", () => {
    expect(acaoDaMeta({ metaId: "m1", editada: true, valor: 3000 })).toBe("atualizar");
  });

  it("campo não mexido, apagado ou zerado: mantém a meta como está", () => {
    expect(acaoDaMeta({ metaId: "m1", editada: false, valor: 3000 })).toBe("manter");
    expect(acaoDaMeta({ metaId: "m1", editada: true, valor: null })).toBe("manter");
    expect(acaoDaMeta({ metaId: null, editada: true, valor: 0 })).toBe("manter");
  });
});
