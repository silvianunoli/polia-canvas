import { describe, expect, it } from "vitest";
import {
  canalQueMaisPesa,
  lucroDaConta,
  linhasPorCanal,
  lucroNoCanal,
  precoParaLucrar,
  resumoPorCanal,
} from "./precoPorCanal";
import type { Venda } from "./vendas";

describe("lucroNoCanal", () => {
  it("tira custo, imposto e a taxa do canal", () => {
    // 59 - 33 - 5% de 59 (2,95) - (20% de 59 = 11,80 + 4) = 7,25
    expect(
      lucroNoCanal({ preco: 59, custo: 33, impostosPct: 5, regra: { percentual: 20, fixo: 4 } }),
    ).toBe(7.25);
  });
  it("sem regra é sem taxa", () => {
    expect(lucroNoCanal({ preco: 59, custo: 33, impostosPct: 0, regra: null })).toBe(26);
  });
});

describe("precoParaLucrar", () => {
  it("acha o preço que devolve o mesmo lucro no canal", () => {
    const regra = { percentual: 20, fixo: 4 };
    const preco = precoParaLucrar({ lucroAlvo: 12.4, custo: 33, impostosPct: 5, regra })!;
    expect(lucroNoCanal({ preco, custo: 33, impostosPct: 5, regra })).toBeGreaterThanOrEqual(12.4);
    // um centavo a menos já não chega
    expect(
      lucroNoCanal({
        preco: Math.round((preco - 0.01) * 100) / 100,
        custo: 33,
        impostosPct: 5,
        regra,
      }),
    ).toBeLessThan(12.4);
  });
  it("sem taxa nem imposto é custo + lucro", () => {
    expect(precoParaLucrar({ lucroAlvo: 10, custo: 30, impostosPct: 0, regra: null })).toBe(40);
  });
  it("taxa + imposto em 100% não tem preço", () => {
    expect(
      precoParaLucrar({
        lucroAlvo: 10,
        custo: 30,
        impostosPct: 50,
        regra: { percentual: 50, fixo: 0 },
      }),
    ).toBeNull();
  });
});

describe("linhasPorCanal e canalQueMaisPesa", () => {
  const taxas = {
    shopee: { percentual: 20, fixo: 4 },
    pix: { percentual: 0, fixo: 0 },
    credito: { percentual: 3.19, fixo: 0 },
  };
  const linhas = linhasPorCanal({ preco: 59, custo: 33, impostosPct: 0, lucroBase: 24, taxas });

  it("só canais cadastrados, na ordem do mais barato pro marketplace", () => {
    expect(linhas.map((l) => l.chave)).toEqual(["pix", "credito", "shopee"]);
    expect(linhas[0].rotulo).toBe("Pix");
  });
  it("aponta o canal que mais derruba o lucro", () => {
    expect(canalQueMaisPesa(linhas, 24)?.chave).toBe("shopee");
  });
  it("não aponta nada quando nenhum canal pesa", () => {
    const so = linhasPorCanal({
      preco: 59,
      custo: 33,
      impostosPct: 0,
      lucroBase: 26,
      taxas: { pix: taxas.pix },
    });
    expect(canalQueMaisPesa(so, 26)).toBeNull();
  });
});

describe("resumoPorCanal", () => {
  const v = (canal: "instagram" | "whatsapp", extra: Partial<Venda> & { total: number }) => ({
    canal,
    status: "recebida" as const,
    desconto: 0,
    taxaCanal: 0,
    itens: [
      {
        produtoId: "a",
        produtoNome: "a",
        quantidade: 1,
        precoUnitario: extra.total,
        custoUnitario: 10,
      },
    ],
    ...extra,
  });

  it("soma por canal, ignora canceladas e conta as sem custo", () => {
    const r = resumoPorCanal([
      v("instagram", { total: 50, taxaCanal: 2 }),
      v("instagram", { total: 30 }),
      v("whatsapp", { total: 100, status: "cancelada" }),
      v("whatsapp", {
        total: 20,
        itens: [
          {
            produtoId: "b",
            produtoNome: "b",
            quantidade: 1,
            precoUnitario: 20,
            custoUnitario: null,
          },
        ],
      }),
    ]);
    expect(r).toEqual([
      { canal: "instagram", vendas: 2, vendeu: 80, taxa: 2, lucrou: 58, comCusto: 2, semCusto: 0 },
      { canal: "whatsapp", vendas: 1, vendeu: 20, taxa: 0, lucrou: 0, comCusto: 0, semCusto: 1 },
    ]);
  });
});

describe("lucro da conta e casos sem lucro", () => {
  it("canal com a mesma taxa da conta dá o mesmo lucro, sem frase", () => {
    // caso real da revisão: custo 6,37, taxa 4,99%, imposto 6%, preço 10,79
    const base = lucroDaConta({ preco: 10.79, custo: 6.37, impostosPct: 6, taxaPct: 4.99 });
    const linhas = linhasPorCanal({
      preco: 10.79,
      custo: 6.37,
      impostosPct: 6,
      lucroBase: base,
      taxas: { link: { percentual: 4.99, fixo: 0 } },
    });
    expect(linhas[0].lucro).toBe(base);
    expect(linhas[0].precoParaMesmoLucro).toBe(10.79);
    expect(canalQueMaisPesa(linhas, base)).toBeNull();
  });
  it("sem lucro na conta não busca preço nem aponta canal", () => {
    const linhas = linhasPorCanal({
      preco: 30,
      custo: 35,
      impostosPct: 0,
      lucroBase: -5,
      taxas: { shopee: { percentual: 20, fixo: 4 } },
    });
    expect(linhas[0].precoParaMesmoLucro).toBeNull();
    expect(canalQueMaisPesa(linhas, -5)).toBeNull();
  });
});
