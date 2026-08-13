import { describe, it, expect } from "vitest";
import {
  periodoMensal,
  resultadoDoMes,
  produtosPorSobra,
  montarPromptRaioX,
  sanearRespostaRaioX,
} from "./raiox.functions";

describe("periodoMensal", () => {
  it("formata ano-mes em UTC", () => {
    expect(periodoMensal(new Date(Date.UTC(2026, 6, 15)))).toBe("2026-07");
  });
});

describe("resultadoDoMes", () => {
  it("soma entradas/saídas e conta o total de lançamentos só do mês pedido", () => {
    const r = resultadoDoMes(
      [
        { tipo: "entrada", valor: 500, data: "2026-07-05" },
        { tipo: "saida", valor: 200, data: "2026-07-10" },
        { tipo: "entrada", valor: 999, data: "2026-06-30" },
      ],
      7,
      2026,
    );
    expect(r).toEqual({ entradas: 500, saidas: 200, resultado: 300, totalLancamentos: 2 });
  });

  it("mês sem lançamento retorna tudo zerado", () => {
    expect(resultadoDoMes([], 7, 2026)).toEqual({
      entradas: 0,
      saidas: 0,
      resultado: 0,
      totalLancamentos: 0,
    });
  });
});

describe("produtosPorSobra", () => {
  it("rankeia do maior pro menor sobra %, ignorando produto sem preço", () => {
    const r = produtosPorSobra([
      { nome: "A", preco_venda: 100, preco_custo: 80, calculadora_breakdown: null }, // 20%
      { nome: "B", preco_venda: 100, preco_custo: 50, calculadora_breakdown: null }, // 50%
      { nome: "C", preco_venda: 0, preco_custo: 10, calculadora_breakdown: null }, // sem preço, ignorado
    ]);
    expect(r.map((p) => p.nome)).toEqual(["B", "A"]);
  });

  it("usa taxa/imposto do breakdown salvo quando existe", () => {
    const r = produtosPorSobra([
      {
        nome: "Com taxa",
        preco_venda: 100,
        preco_custo: 50,
        calculadora_breakdown: { perfil: "produto", valores: { taxaVenda: "10", impostos: "0" } },
      },
    ]);
    // sobra = 100 - 50 - 10 (10% de taxa) = 40 -> 40%
    expect(r[0].sobraPct).toBe(40);
  });
});

describe("montarPromptRaioX", () => {
  it("nunca inventa número — só usa os valores passados no contexto", () => {
    const { prompt } = montarPromptRaioX({
      mes: "2026-07",
      entradas: 1000,
      saidas: 400,
      resultado: 600,
      metaAlvo: 2000,
      metaAtual: 1000,
      produtos: [{ nome: "Bolo", sobraPct: 30 }],
      dadoRalo: false,
    });
    // pt-BR: ponto de milhar, vírgula decimal. O formato americano ("1000.00")
    // vazava para a tela porque o modelo repete o que recebe no prompt.
    expect(prompt).toContain("R$ 1.000,00");
    expect(prompt).toContain("R$ 600,00");
    expect(prompt).toContain("Bolo (30%)");
    expect(prompt).not.toMatch(/\d\.\d{2}(\D|$)/);
  });

  it("avisa quando o dado é ralo", () => {
    const { prompt } = montarPromptRaioX({
      mes: "2026-07",
      entradas: 50,
      saidas: 0,
      resultado: 50,
      metaAlvo: null,
      metaAtual: null,
      produtos: [],
      dadoRalo: true,
    });
    expect(prompt).toContain("poucos lançamentos");
  });
});

describe("sanearRespostaRaioX", () => {
  it("aceita uma resposta bem formada", () => {
    const r = sanearRespostaRaioX({
      placar: "Sobrou bem esse mês.",
      causas: "As vendas do produto X puxaram o resultado.",
      sugestoes: [{ texto: "Ajuste o preço do produto Y.", rota: "produtos" }],
    });
    expect(r.sugestoes[0].rota).toBe("produtos");
  });

  it("sanitiza rota inválida/inventada pra null, sem quebrar", () => {
    const r = sanearRespostaRaioX({
      placar: "Placar",
      causas: "Causas",
      sugestoes: [{ texto: "Fala com seu advogado", rota: "juridico_inventado" }],
    });
    expect(r.sugestoes[0].rota).toBeNull();
  });

  it("rejeita um JSON fora do formato esperado (lança, quem chama trata como falha)", () => {
    expect(() => sanearRespostaRaioX({ placar: 123 })).toThrow();
  });
});
