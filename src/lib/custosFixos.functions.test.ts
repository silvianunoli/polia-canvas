import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_CUSTO_FIXO,
  ITENS_CUSTO_FIXO,
  custosFixosPorItem,
  somarCustosFixos,
} from "@/lib/custosFixos.functions";
import { CATEGORIA_INSUMOS, custosFixosDoMes } from "@/lib/projecao.functions";
import { CATEGORIA_PRO_LABORE } from "@/lib/resumoContador.functions";
import type { LancamentoResumo } from "@/lib/resumoContador.functions";
import {
  calcularRateio,
  custoDiretoDoProduto,
  rateioDoBreakdown,
  type CalculadoraBreakdown,
} from "@/lib/precificacao.functions";

const lanc = (over: Partial<LancamentoResumo>): LancamentoResumo => ({
  id: "1",
  data: "2026-10-05",
  tipo: "saida",
  categoria: null,
  descricao: null,
  valor: 0,
  ...over,
});

describe("somarCustosFixos", () => {
  it("soma os itens preenchidos e ignora vazio, texto e negativo", () => {
    expect(
      somarCustosFixos({ espaco: "800", internet: "120,50", marketing: "", taxas: "-10" }),
    ).toBe(920.5);
  });

  it("sem nada preenchido dá zero", () => {
    expect(somarCustosFixos({})).toBe(0);
  });
});

describe("custosFixosPorItem", () => {
  const lancamentos = [
    lanc({ categoria: "Espaço (aluguel)", valor: 800 }),
    lanc({ categoria: "  internet e TELEFONE ", valor: 120 }),
    lanc({ categoria: "Ferramentas e assinaturas", valor: 60 }),
    lanc({ categoria: "Marketing", valor: 200 }),
    lanc({ categoria: "Papelaria pro escritório", valor: 30 }), // criada por ela
    lanc({ categoria: null, valor: 10 }),
    lanc({ categoria: CATEGORIA_INSUMOS, valor: 1000 }),
    lanc({ categoria: CATEGORIA_PRO_LABORE, valor: 3000 }),
    lanc({ tipo: "entrada", categoria: "Marketing", valor: 999 }),
    lanc({ data: "2026-09-30", categoria: "Marketing", valor: 999 }),
  ];

  it("cai no item da mesma categoria do Financeiro; o resto vai pra Outros", () => {
    const r = custosFixosPorItem(lancamentos, 10, 2026);
    expect(r.espaco).toBe(800);
    expect(r.internet).toBe(120);
    expect(r.ferramentas).toBe(60);
    expect(r.marketing).toBe(200);
    expect(r.outros).toBe(40);
    expect(r.contador).toBe(0);
  });

  it("deixa insumo e pró-labore de fora e bate com o total da Projeção", () => {
    const r = custosFixosPorItem(lancamentos, 10, 2026);
    const soma = Object.values(r).reduce((a, b) => a + b, 0);
    expect(soma).toBe(1220);
    expect(soma).toBe(custosFixosDoMes(lancamentos, 10, 2026));
  });
});

describe("categorias do Financeiro", () => {
  it("todo item de custo fixo tem chip de saída, menos Outros que já existe lá", () => {
    expect(CATEGORIAS_CUSTO_FIXO).toHaveLength(ITENS_CUSTO_FIXO.length - 1);
    expect(CATEGORIAS_CUSTO_FIXO).not.toContain("Outros");
    expect(CATEGORIAS_CUSTO_FIXO).toContain("Marketing");
    expect(CATEGORIAS_CUSTO_FIXO).toContain("Ferramentas e assinaturas");
  });
});

describe("rateio dos custos fixos e do pró-labore", () => {
  it("divide fixos + salário pela quantidade do mês", () => {
    expect(calcularRateio({ custosFixosMes: 600, proLaboreMes: 2400, qtdMes: 100 })).toBe(30);
  });

  it("quantidade vazia divide por 1, como antes", () => {
    expect(calcularRateio({ custosFixosMes: 300, qtdMes: 0 })).toBe(300);
  });

  const bkProduto: CalculadoraBreakdown = {
    perfil: "produto",
    valores: {
      materiaPrima: "8",
      embalagem: "2",
      maoObra: "5",
      despesasFixas: "300",
      proLabore: "2000",
      qtd: "50",
    },
  };

  it("produto: rateio leva fixos e salário; a Projeção recebe só o custo direto", () => {
    expect(rateioDoBreakdown(bkProduto)).toBe(46);
    expect(custoDiretoDoProduto(61, bkProduto)).toBe(15);
  });

  const bkServico: CalculadoraBreakdown = {
    perfil: "servico",
    valores: {
      valorHora: "50",
      horas: "4",
      materiais: "20",
      despesasFixas: "1000",
      qtdServicos: "20",
      proLabore: "5000", // ignorado: no serviço o salário vem do valor da hora
    },
  };

  it("serviço: rateia só os fixos e tira o rateio do custo direto", () => {
    expect(rateioDoBreakdown(bkServico)).toBe(50);
    expect(custoDiretoDoProduto(270, bkServico)).toBe(220);
  });

  it("serviço salvo antes de 09/10 (sem custos fixos) continua igual", () => {
    const antigo: CalculadoraBreakdown = {
      perfil: "servico",
      valores: { valorHora: "50", horas: "4", materiais: "20" },
    };
    expect(rateioDoBreakdown(antigo)).toBe(0);
    expect(custoDiretoDoProduto(220, antigo)).toBe(220);
  });
});
