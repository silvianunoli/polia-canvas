import { describe, it, expect } from "vitest";
import {
  avisosDoRaioX,
  escolherMetaDoRaioX,
  mesJaPassou,
  produtosDoRaioX,
  situacaoDoProdutoNoMes,
  type ProdutoDoBanco,
} from "./raioxHistorico";

function produto(over: Partial<ProdutoDoBanco> = {}): ProdutoDoBanco {
  return {
    nome: "Caderno",
    preco_venda: 100,
    preco_custo: 40,
    calculadora_breakdown: null,
    historico_precos: [],
    preco_atualizado_em: null,
    created_at: "2026-06-01T15:00:00Z",
    updated_at: "2026-06-01T15:00:00Z",
    ...over,
  };
}

describe("mesJaPassou", () => {
  it("mês anterior no mesmo ano e ano anterior já passaram", () => {
    expect(mesJaPassou({ ano: 2026, mes: 9 }, { ano: 2026, mes: 10 })).toBe(true);
    expect(mesJaPassou({ ano: 2025, mes: 12 }, { ano: 2026, mes: 1 })).toBe(true);
  });
  it("mês corrente e futuro não passaram", () => {
    expect(mesJaPassou({ ano: 2026, mes: 10 }, { ano: 2026, mes: 10 })).toBe(false);
    expect(mesJaPassou({ ano: 2026, mes: 11 }, { ano: 2026, mes: 10 })).toBe(false);
  });
});

describe("escolherMetaDoRaioX", () => {
  it("mês corrente usa a meta de hoje, sem aviso", () => {
    expect(
      escolherMetaDoRaioX({ mesPassado: false, metaDoHistorico: 500, metaDeHoje: 900 }),
    ).toEqual({ valorAlvo: 900, usaMetaDeHoje: false });
  });
  it("mês passado com histórico usa o valor daquele mês", () => {
    expect(
      escolherMetaDoRaioX({ mesPassado: true, metaDoHistorico: 500, metaDeHoje: 900 }),
    ).toEqual({ valorAlvo: 500, usaMetaDeHoje: false });
  });
  it("histórico com meta zero ainda é histórico", () => {
    expect(
      escolherMetaDoRaioX({ mesPassado: true, metaDoHistorico: 0, metaDeHoje: 900 }),
    ).toEqual({ valorAlvo: 0, usaMetaDeHoje: false });
  });
  it("mês passado sem histórico (ou sem a tabela) cai na meta de hoje e avisa", () => {
    expect(
      escolherMetaDoRaioX({ mesPassado: true, metaDoHistorico: null, metaDeHoje: 900 }),
    ).toEqual({ valorAlvo: 900, usaMetaDeHoje: true });
  });
  it("sem meta nenhuma não avisa nada", () => {
    expect(
      escolherMetaDoRaioX({ mesPassado: true, metaDoHistorico: null, metaDeHoje: null }),
    ).toEqual({ valorAlvo: null, usaMetaDeHoje: false });
  });
});

describe("situacaoDoProdutoNoMes", () => {
  const FIM_SETEMBRO = "2026-10-01";

  it("produto criado depois do mês fica fora", () => {
    expect(
      situacaoDoProdutoNoMes(produto({ created_at: "2026-10-02T12:00:00Z" }), FIM_SETEMBRO),
    ).toEqual({ existia: false });
  });

  it("criado às 22h de 30/09 em Brasília (01/10 em UTC) ainda existia em setembro", () => {
    const s = situacaoDoProdutoNoMes(
      produto({ created_at: "2026-10-01T01:00:00Z", updated_at: "2026-10-01T01:00:00Z" }),
      FIM_SETEMBRO,
    );
    expect(s.existia).toBe(true);
  });

  it("não editado depois do mês: preço e custo são do mês", () => {
    const s = situacaoDoProdutoNoMes(produto(), FIM_SETEMBRO);
    expect(s).toMatchObject({ existia: true, precoDoMes: true, custoDoMes: true });
  });

  it("preço trocado depois do mês: usa a troca mais antiga a partir do fim do mês", () => {
    const s = situacaoDoProdutoNoMes(
      produto({
        preco_venda: 150,
        updated_at: "2026-10-20T12:00:00Z",
        preco_atualizado_em: "2026-10-20T12:00:00Z",
        // mais novo primeiro, como ModalProduto/Calculadora gravam
        historico_precos: [
          { preco: 120, data: "2026-10-20" },
          { preco: 100, data: "2026-10-05" },
          { preco: 80, data: "2026-09-10" },
        ],
      }),
      FIM_SETEMBRO,
    );
    expect(s).toMatchObject({
      existia: true,
      produto: { preco_venda: 100 },
      precoDoMes: true,
      custoDoMes: false,
    });
  });

  it("troca no próprio dia 1º do mês seguinte conta como depois do mês", () => {
    const s = situacaoDoProdutoNoMes(
      produto({
        preco_venda: 130,
        updated_at: "2026-10-01T12:00:00Z",
        preco_atualizado_em: "2026-10-01T12:00:00Z",
        historico_precos: [{ preco: 110, data: "2026-10-01" }],
      }),
      FIM_SETEMBRO,
    );
    expect(s).toMatchObject({ produto: { preco_venda: 110 }, precoDoMes: true });
  });

  it("só trocas dentro do mês: o preço de hoje já valia no fim do mês", () => {
    const s = situacaoDoProdutoNoMes(
      produto({
        preco_venda: 90,
        updated_at: "2026-10-03T12:00:00Z", // editou o custo em outubro
        preco_atualizado_em: "2026-09-15T12:00:00Z",
        historico_precos: [{ preco: 70, data: "2026-09-15" }],
      }),
      FIM_SETEMBRO,
    );
    expect(s).toMatchObject({ produto: { preco_venda: 90 }, precoDoMes: true, custoDoMes: false });
  });

  it("preço mudou depois do mês sem deixar histórico: não dá pra saber", () => {
    const s = situacaoDoProdutoNoMes(
      produto({
        preco_venda: 90,
        updated_at: "2026-10-03T12:00:00Z",
        preco_atualizado_em: "2026-10-03T12:00:00Z",
        historico_precos: [],
      }),
      FIM_SETEMBRO,
    );
    expect(s).toMatchObject({ produto: { preco_venda: 90 }, precoDoMes: false, custoDoMes: false });
  });

  it("ignora entrada de histórico malformada", () => {
    const s = situacaoDoProdutoNoMes(
      produto({
        preco_venda: 90,
        updated_at: "2026-10-03T12:00:00Z",
        preco_atualizado_em: "2026-10-03T12:00:00Z",
        historico_precos: [{ preco: "abc", data: "2026-10-03" }, { preco: 50 }, null],
      }),
      FIM_SETEMBRO,
    );
    expect(s).toMatchObject({ produto: { preco_venda: 90 }, precoDoMes: false });
  });
});

describe("produtosDoRaioX", () => {
  const SETEMBRO = { ano: 2026, mes: 9 };

  it("mês corrente devolve os produtos como estão, sem aviso", () => {
    const r = produtosDoRaioX(
      [produto({ historico_precos: [{ preco: 1, data: "2026-12-01" }] })],
      SETEMBRO,
      false,
    );
    expect(r.produtos[0].preco_venda).toBe(100);
    expect(r.usaPrecoDeHoje).toBe(false);
    expect(r.usaCustoDeHoje).toBe(false);
  });

  it("mês passado: tira produto novo, aplica o preço do mês e marca custo de hoje", () => {
    const r = produtosDoRaioX(
      [
        produto({ nome: "Antigo" }),
        produto({ nome: "Novo", created_at: "2026-10-05T12:00:00Z" }),
        produto({
          nome: "Reajustado",
          preco_venda: 200,
          updated_at: "2026-10-05T12:00:00Z",
          preco_atualizado_em: "2026-10-05T12:00:00Z",
          historico_precos: [{ preco: 160, data: "2026-10-05" }],
        }),
      ],
      SETEMBRO,
      true,
    );
    expect(r.produtos.map((p) => [p.nome, p.preco_venda])).toEqual([
      ["Antigo", 100],
      ["Reajustado", 160],
    ]);
    expect(r.usaPrecoDeHoje).toBe(false);
    expect(r.usaCustoDeHoje).toBe(true);
  });

  it("produto sem preço não dispara aviso (fica fora do ranking)", () => {
    const r = produtosDoRaioX(
      [
        produto({
          preco_venda: 0,
          updated_at: "2026-10-05T12:00:00Z",
          preco_atualizado_em: "2026-10-05T12:00:00Z",
        }),
      ],
      SETEMBRO,
      true,
    );
    expect(r.usaPrecoDeHoje).toBe(false);
    expect(r.usaCustoDeHoje).toBe(false);
  });
});

describe("avisosDoRaioX", () => {
  it("sem nada de hoje no lugar do mês, nenhum aviso", () => {
    expect(
      avisosDoRaioX({
        alvo: { ano: 2026, mes: 8 },
        usaMetaDeHoje: false,
        usaPrecoDeHoje: false,
        usaCustoDeHoje: false,
      }),
    ).toEqual([]);
  });

  it("frase da meta com o nome do mês, sem travessão nem exclamação", () => {
    const avisos = avisosDoRaioX({
      alvo: { ano: 2026, mes: 8 },
      usaMetaDeHoje: true,
      usaPrecoDeHoje: true,
      usaCustoDeHoje: true,
    });
    expect(avisos[0]).toBe("A meta de agosto não ficou guardada; a leitura usa a meta de hoje.");
    expect(avisos).toHaveLength(3);
    for (const a of avisos) {
      expect(a).not.toMatch(/[—–!]/);
      expect(a).not.toMatch(/margem/i);
    }
  });
});
