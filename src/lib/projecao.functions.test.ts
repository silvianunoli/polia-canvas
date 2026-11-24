import { describe, expect, it } from "vitest";
import {
  acaoDaMeta,
  CATEGORIA_INSUMOS,
  custosFixosDoMes,
  custosFixosDePartida,
  ehCategoriaInsumos,
  entradasDoMes,
  mesAnterior,
  montarFaltaNoMes,
  salarioDePartida,
  insumosDoMes,
  lerValorReais,
  paraCampoReais,
  valorDoCampo,
  custoMedio,
  mediaTaxas,
  montarProjecao,
  proLaboreJaLancado,
  reservaForaDoFinanceiro,
  separarForaDaCurva,
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

describe("separarForaDaCurva (ONE-122)", () => {
  it("tira o produto de preço muito acima dos outros", () => {
    const caro = produto({ precoVenda: 500, precoCusto: 45 });
    const produtos = [50, 55, 60, 65].map((v) => produto({ precoVenda: v, precoCusto: 40 }));
    const { naMedia, foraDaCurva } = separarForaDaCurva([...produtos, caro]);
    expect(foraDaCurva).toEqual([caro]);
    expect(naMedia).toHaveLength(4);
    expect(ticketMedio(naMedia)).toBe(57.5);
  });

  it("tira pelo custo também, e das três médias juntas", () => {
    const custoso = produto({ precoVenda: 100, precoCusto: 90 });
    const produtos = [10, 12, 11, 13].map((c) => produto({ precoVenda: 100, precoCusto: c }));
    const { naMedia, foraDaCurva } = separarForaDaCurva([...produtos, custoso]);
    expect(foraDaCurva).toEqual([custoso]);
    expect(custoMedio(naMedia)).toBe(11.5);
  });

  it("produto barato demais também sai", () => {
    const brinde = produto({ precoVenda: 2, precoCusto: 1 });
    const produtos = [80, 90, 100, 110].map((v) => produto({ precoVenda: v, precoCusto: 30 }));
    expect(separarForaDaCurva([...produtos, brinde]).foraDaCurva).toEqual([brinde]);
  });

  it("com menos de 4 produtos ninguém sai", () => {
    const produtos = [
      produto({ precoVenda: 10 }),
      produto({ precoVenda: 10 }),
      produto({ precoVenda: 1000 }),
    ];
    const { naMedia, foraDaCurva } = separarForaDaCurva(produtos);
    expect(foraDaCurva).toEqual([]);
    expect(naMedia).toHaveLength(3);
  });

  it("um pouco diferente de vários iguais não é fora da curva", () => {
    const produtos = [50, 50, 50, 50, 50, 60].map((v) =>
      produto({ precoVenda: v, precoCusto: 20 }),
    );
    expect(separarForaDaCurva(produtos).foraDaCurva).toEqual([]);
  });

  it("produto sem preço de venda não entra em nenhum dos dois", () => {
    const produtos = [produto({ precoVenda: 0 }), produto({ precoVenda: 100 })];
    const { naMedia, foraDaCurva } = separarForaDaCurva(produtos);
    expect(naMedia).toHaveLength(1);
    expect(foraDaCurva).toEqual([]);
  });
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

  // ONE-95: o preco_custo da calculadora já traz o rateio dos fixos, e a
  // Projeção soma os fixos à parte. Caderno do teste de 08/10: 8 + 2 + 5 de
  // custo direto, R$ 300 de fixos em 50 vendas (rateio 6), preço 30,43.
  const bkCaderno = {
    perfil: "produto" as const,
    valores: {
      materiaPrima: "8",
      embalagem: "2",
      maoObra: "5",
      outrosDiretos: "",
      despesasFixas: "300",
      qtd: "50",
      taxaVenda: "5",
      impostos: "6",
      margem: "20",
    },
  };

  it("tira do custo o rateio dos fixos que a calculadora embutiu", () => {
    const p = produto({ precoVenda: 30.43, precoCusto: 21, calculadora_breakdown: bkCaderno });
    expect(custoMedio([p])).toBe(15);
  });

  it("custo editado à mão depois da calculadora fica como está", () => {
    const p = produto({ precoVenda: 30.43, precoCusto: 18, calculadora_breakdown: bkCaderno });
    expect(custoMedio([p])).toBe(18);
  });

  it("ponto de empate do caderno conta o fixo uma vez só: 25 vendas, não 50", () => {
    const p = produto({ precoVenda: 30.43, precoCusto: 21, calculadora_breakdown: bkCaderno });
    const sobra = sobraPorVenda({
      ticketMedio: ticketMedio([p]),
      custoMedio: custoMedio([p]),
      ...mediaTaxas([p]),
    });
    expect(vendasParaAlvo(300, sobra)).toBe(25);
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

describe("mesAnterior", () => {
  it("volta um mês e vira o ano em janeiro", () => {
    expect(mesAnterior(11, 2026)).toEqual({ mes: 10, ano: 2026 });
    expect(mesAnterior(1, 2027)).toEqual({ mes: 12, ano: 2026 });
  });
});

describe("custosFixosDePartida (ONE-241: mês pela metade não vira custo do mês)", () => {
  it("no começo do mês, usa o mês fechado", () => {
    const lancamentos = [
      lanc({ data: "2026-10-05", categoria: "Aluguel", valor: 800 }),
      lanc({ data: "2026-10-10", categoria: "Internet", valor: 100 }),
      lanc({ data: "2026-11-02", categoria: "Internet", valor: 100 }),
    ];
    expect(custosFixosDePartida(lancamentos, 11, 2026)).toEqual({
      valor: 900,
      origem: "mes-anterior",
      doMesAtual: 100,
      doMesAnterior: 900,
    });
  });

  it("quando o mês corrente já passou do fechado, usa o corrente", () => {
    const lancamentos = [
      lanc({ data: "2026-10-05", categoria: "Aluguel", valor: 800 }),
      lanc({ data: "2026-11-05", categoria: "Aluguel", valor: 800 }),
      lanc({ data: "2026-11-20", categoria: "Marketing", valor: 300 }),
    ];
    const r = custosFixosDePartida(lancamentos, 11, 2026);
    expect(r.valor).toBe(1100);
    expect(r.origem).toBe("mes-atual");
  });

  it("dia 1 de janeiro olha dezembro do ano anterior", () => {
    const lancamentos = [lanc({ data: "2026-12-10", categoria: "Aluguel", valor: 700 })];
    expect(custosFixosDePartida(lancamentos, 1, 2027).valor).toBe(700);
  });

  it("insumo, pró-labore e equipamento continuam fora nos dois meses", () => {
    const lancamentos = [
      lanc({ data: "2026-10-05", categoria: "Aluguel", valor: 500 }),
      lanc({ data: "2026-10-06", categoria: CATEGORIA_INSUMOS, valor: 900 }),
      lanc({ data: "2026-10-07", categoria: "Pró-labore", valor: 2000 }),
    ];
    expect(custosFixosDePartida(lancamentos, 11, 2026).valor).toBe(500);
  });
});

describe("salarioDePartida (ONE-241: pró-labore parcial não vira salário desejado)", () => {
  it("o salvo na Projeção vem primeiro", () => {
    expect(
      salarioDePartida({ salvo: 3000, doPlanejamento: 2500, lancadoMesAnterior: 2000 }),
    ).toEqual({ valor: 3000, origem: "salvo" });
  });

  it("sem salvo, usa o do Planejamento", () => {
    expect(
      salarioDePartida({ salvo: null, doPlanejamento: 2500, lancadoMesAnterior: 2000 }),
    ).toEqual({ valor: 2500, origem: "planejamento" });
  });

  it("sem salvo nem Planejamento, usa o pró-labore do mês fechado", () => {
    expect(salarioDePartida({ salvo: 0, doPlanejamento: null, lancadoMesAnterior: 2000 })).toEqual({
      valor: 2000,
      origem: "mes-anterior",
    });
  });

  it("sem nada, começa vazio", () => {
    expect(salarioDePartida({ salvo: null, doPlanejamento: null, lancadoMesAnterior: 0 })).toEqual({
      valor: null,
      origem: null,
    });
  });
});

describe("entradasDoMes", () => {
  it("soma só as entradas do mês pedido", () => {
    const lancamentos = [
      lanc({ data: "2026-11-03", tipo: "entrada", valor: 490 }),
      lanc({ data: "2026-11-20", tipo: "entrada", valor: 1470 }),
      lanc({ data: "2026-10-30", tipo: "entrada", valor: 999 }),
      lanc({ data: "2026-11-10", tipo: "saida", valor: 300 }),
    ];
    expect(entradasDoMes(lancamentos, 11, 2026)).toBe(1960);
  });
});

describe("montarFaltaNoMes (ONE-241: 'faltam' de verdade)", () => {
  // sobra de 50 por venda, ticket de 100
  const base = {
    custosFixos: 1000,
    proLaboreDesejado: 2000,
    metaAlvo: 5000 as number | null,
    ticketMedio: 100,
    sobra: 50,
  };

  it("sem nada entrado, falta o mês inteiro (bate com montarProjecao)", () => {
    const falta = montarFaltaNoMes({ ...base, jaEntrou: 0 })!;
    const total = montarProjecao(base)!;
    expect(falta.empatar.vendas).toBe(total.empatar.vendas);
    expect(falta.sePagar.vendas).toBe(total.sePagar.vendas);
    expect(falta.meta!.vendas).toBe(total.meta!.vendas);
  });

  it("desconta o que já entrou: R$ 1.500 = 15 vendas feitas", () => {
    const falta = montarFaltaNoMes({ ...base, jaEntrou: 1500 })!;
    expect(falta.empatar).toEqual({ vendas: 5, faturamento: 500 }); // 20 - 15
    expect(falta.sePagar).toEqual({ vendas: 45, faturamento: 4500 }); // 60 - 15
    expect(falta.meta).toEqual({ vendas: 35, faturamento: 3500 }); // 5000 - 1500
  });

  it("alvo já batido vira zero, nunca negativo", () => {
    const falta = montarFaltaNoMes({ ...base, jaEntrou: 9000 })!;
    expect(falta.empatar.vendas).toBe(0);
    expect(falta.sePagar.vendas).toBe(0);
    expect(falta.meta).toEqual({ vendas: 0, faturamento: 0 });
  });

  it("venda fracionada arredonda pra cima", () => {
    // 20 vendas no mês, entrou o equivalente a 14,5
    expect(montarFaltaNoMes({ ...base, jaEntrou: 1450 })!.empatar.vendas).toBe(6);
  });

  it("sem sobra ou sem ticket, não há conta", () => {
    expect(montarFaltaNoMes({ ...base, sobra: 0, jaEntrou: 0 })).toBeNull();
    expect(montarFaltaNoMes({ ...base, ticketMedio: 0, jaEntrou: 0 })).toBeNull();
  });

  it("meta null continua null", () => {
    expect(montarFaltaNoMes({ ...base, metaAlvo: null, jaEntrou: 100 })!.meta).toBeNull();
  });
});

describe("reservaForaDoFinanceiro (ONE-251: a parcela da máquina é custo fixo)", () => {
  it("sem reserva lançada, entra a reserva inteira da aba Equipamentos", () => {
    const lancamentos = [lanc({ data: "2026-10-05", categoria: "Aluguel", valor: 800 })];
    expect(
      reservaForaDoFinanceiro({ lancamentos, mes: 10, ano: 2026, reservaDoMes: 73.59 }),
    ).toBe(73.59);
  });

  it("desconta a reserva já lançada no Financeiro naquele mês, sem contar duas vezes", () => {
    const lancamentos = [
      lanc({ data: "2026-10-05", categoria: " reserva de equipamento ", valor: 50 }),
      lanc({ data: "2026-11-05", categoria: "Reserva de equipamento", valor: 999 }),
    ];
    expect(
      reservaForaDoFinanceiro({ lancamentos, mes: 10, ano: 2026, reservaDoMes: 73.59 }),
    ).toBe(23.59);
  });

  it("reserva lançada maior que a da aba não deixa número negativo", () => {
    const lancamentos = [
      lanc({ data: "2026-10-05", categoria: "Reserva de equipamento", valor: 200 }),
    ];
    expect(reservaForaDoFinanceiro({ lancamentos, mes: 10, ano: 2026, reservaDoMes: 100 })).toBe(0);
  });

  it("sem equipamento cadastrado, não soma nada", () => {
    expect(reservaForaDoFinanceiro({ lancamentos: [], mes: 10, ano: 2026, reservaDoMes: 0 })).toBe(0);
  });
});
