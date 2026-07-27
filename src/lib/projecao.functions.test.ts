import { describe, expect, it } from "vitest";
import {
  custosFixosDoMes,
  custoMedio,
  mediaTaxas,
  montarProjecao,
  proLaboreJaLancado,
  sobraPorVenda,
  ticketMedio,
  vendasParaAlvo,
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
