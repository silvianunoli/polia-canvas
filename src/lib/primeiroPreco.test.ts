import { describe, expect, it } from "vitest";

import {
  deveGuardarSozinho,
  ehErroDeCota,
  lucroDoProdutoCalculado,
  nomeParaGuardar,
  nomeProvisorio,
  NOME_PRODUTO_MAX,
  resultadoProntoPraGuardar,
  tipoDoProduto,
} from "./primeiroPreco";

describe("deveGuardarSozinho", () => {
  it("guarda o primeiro preço de Produto e de Serviço", () => {
    expect(deveGuardarSozinho({ temPreco: false, recalculando: false, perfil: "produto" })).toBe(
      true,
    );
    expect(deveGuardarSozinho({ temPreco: false, recalculando: false, perfil: "servico" })).toBe(
      true,
    );
  });

  it("não guarda quando a conta já tem preço calculado", () => {
    expect(deveGuardarSozinho({ temPreco: true, recalculando: false, perfil: "produto" })).toBe(
      false,
    );
  });

  it("não guarda na Encomenda nem no recálculo", () => {
    expect(deveGuardarSozinho({ temPreco: false, recalculando: false, perfil: "encomenda" })).toBe(
      false,
    );
    expect(deveGuardarSozinho({ temPreco: false, recalculando: true, perfil: "produto" })).toBe(
      false,
    );
  });
});

describe("resultadoProntoPraGuardar", () => {
  it("só com preço válido e o resultado já visto", () => {
    expect(resultadoProntoPraGuardar({ precoNaoSalvavel: false, resultadoVisto: true })).toBe(true);
    expect(resultadoProntoPraGuardar({ precoNaoSalvavel: true, resultadoVisto: true })).toBe(false);
    expect(resultadoProntoPraGuardar({ precoNaoSalvavel: false, resultadoVisto: false })).toBe(
      false,
    );
  });
});

describe("nome", () => {
  it("provisório pela aba", () => {
    expect(nomeProvisorio("produto")).toBe("Primeiro produto");
    expect(nomeProvisorio("servico")).toBe("Primeiro serviço");
  });

  it("vazio volta pro provisório; o digitado vai limpo e com teto", () => {
    expect(nomeParaGuardar("   ", "produto")).toBe("Primeiro produto");
    expect(nomeParaGuardar("  Bolo de pote  ", "produto")).toBe("Bolo de pote");
    expect(nomeParaGuardar("a".repeat(200), "servico")).toHaveLength(NOME_PRODUTO_MAX);
  });
});

describe("tipoDoProduto", () => {
  it("Serviço vira servico, Produto vira fisico", () => {
    expect(tipoDoProduto("servico")).toBe("servico");
    expect(tipoDoProduto("produto")).toBe("fisico");
  });
});

describe("ehErroDeCota", () => {
  it("reconhece a mensagem da trigger de cota", () => {
    expect(
      ehErroDeCota("Limite do plano Grátis atingido (5 produtos). Assine o Premium pra liberar."),
    ).toBe(true);
    expect(ehErroDeCota("Cota do plano Confere atingida (limite de 5 em produtos)")).toBe(true);
    expect(ehErroDeCota("new row violates row-level security policy")).toBe(false);
    expect(ehErroDeCota(null)).toBe(false);
  });
});

describe("lucroDoProdutoCalculado", () => {
  it("tira custo e as taxas do breakdown", () => {
    // 100 - 40 - (10% + 5% de 100) = 45
    expect(
      lucroDoProdutoCalculado({
        precoVenda: 100,
        precoCusto: 40,
        breakdown: { perfil: "produto", valores: { taxaVenda: "10", impostos: "5" } },
      }),
    ).toBeCloseTo(45);
  });

  it("sem custo nem breakdown, o lucro é o preço", () => {
    expect(lucroDoProdutoCalculado({ precoVenda: 30, precoCusto: null, breakdown: null })).toBe(30);
  });
});
