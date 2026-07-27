import { describe, it, expect } from "vitest";
import {
  pertenceAoMes,
  montarResumoContador,
  linhasCsvResumoContador,
  CATEGORIA_PRO_LABORE,
  type LancamentoResumo,
} from "./resumoContador.functions";

function l(overrides: Partial<LancamentoResumo>): LancamentoResumo {
  return {
    id: "id-1",
    data: "2026-07-15",
    tipo: "entrada",
    categoria: null,
    descricao: null,
    valor: 100,
    ...overrides,
  };
}

describe("pertenceAoMes", () => {
  it("reconhece uma data dentro do mês/ano pedido", () => {
    expect(pertenceAoMes("2026-07-01", 7, 2026)).toBe(true);
    expect(pertenceAoMes("2026-07-31", 7, 2026)).toBe(true);
  });

  it("rejeita a borda do mês anterior e do mês seguinte", () => {
    expect(pertenceAoMes("2026-06-30", 7, 2026)).toBe(false);
    expect(pertenceAoMes("2026-08-01", 7, 2026)).toBe(false);
  });

  it("rejeita o mesmo mês em ano diferente", () => {
    expect(pertenceAoMes("2025-07-15", 7, 2026)).toBe(false);
  });
});

describe("montarResumoContador", () => {
  it("soma receitas e despesas só do mês pedido, ignorando outros meses", () => {
    const lancamentos = [
      l({ id: "1", tipo: "entrada", valor: 500, data: "2026-07-05" }),
      l({ id: "2", tipo: "saida", valor: 200, categoria: "Marketing", data: "2026-07-10" }),
      l({ id: "3", tipo: "entrada", valor: 999, data: "2026-06-30" }), // mês anterior, fora
      l({ id: "4", tipo: "saida", valor: 999, categoria: "Marketing", data: "2026-08-01" }), // mês seguinte, fora
    ];
    const resumo = montarResumoContador(lancamentos, 7, 2026);
    expect(resumo.receitas.total).toBe(500);
    expect(resumo.despesas.total).toBe(200);
    expect(resumo.resultado).toBe(300);
  });

  it("isola pró-labore do total 'por categoria' mas soma no total de despesas e no resultado", () => {
    const lancamentos = [
      l({ id: "1", tipo: "entrada", valor: 1000, data: "2026-07-05" }),
      l({ id: "2", tipo: "saida", valor: 300, categoria: "Marketing", data: "2026-07-10" }),
      l({
        id: "3",
        tipo: "saida",
        valor: 400,
        categoria: CATEGORIA_PRO_LABORE,
        data: "2026-07-12",
      }),
    ];
    const resumo = montarResumoContador(lancamentos, 7, 2026);
    expect(resumo.proLabore.total).toBe(400);
    expect(resumo.despesas.porCategoria).toEqual([{ categoria: "Marketing", total: 300 }]);
    expect(resumo.despesas.total).toBe(700); // 300 marketing + 400 pró-labore
    expect(resumo.resultado).toBe(300); // 1000 - 700
  });

  it("agrupa despesas sem categoria como 'Sem categoria', sem quebrar", () => {
    const lancamentos = [
      l({ id: "1", tipo: "saida", valor: 50, categoria: null, data: "2026-07-01" }),
    ];
    const resumo = montarResumoContador(lancamentos, 7, 2026);
    expect(resumo.despesas.porCategoria).toEqual([{ categoria: "Sem categoria", total: 50 }]);
  });

  it("mês sem nenhum lançamento retorna tudo zerado, sem lançar erro", () => {
    const resumo = montarResumoContador([], 7, 2026);
    expect(resumo.receitas.total).toBe(0);
    expect(resumo.despesas.total).toBe(0);
    expect(resumo.proLabore.total).toBe(0);
    expect(resumo.resultado).toBe(0);
  });
});

describe("linhasCsvResumoContador", () => {
  it("gera uma linha por lançamento (receita, despesa e pró-labore juntos), ordenadas por data", () => {
    const resumo = montarResumoContador(
      [
        l({ id: "1", tipo: "entrada", valor: 1000, descricao: "Venda", data: "2026-07-20" }),
        l({ id: "2", tipo: "saida", valor: 300, categoria: "Marketing", data: "2026-07-05" }),
        l({
          id: "3",
          tipo: "saida",
          valor: 400,
          categoria: CATEGORIA_PRO_LABORE,
          data: "2026-07-10",
        }),
      ],
      7,
      2026,
    );
    const linhas = linhasCsvResumoContador(resumo);
    expect(linhas).toEqual([
      ["2026-07-05", "Despesa", "Marketing", "", "300,00"],
      ["2026-07-10", "Despesa", CATEGORIA_PRO_LABORE, "", "400,00"],
      ["2026-07-20", "Receita", "", "Venda", "1000,00"],
    ]);
  });
});
