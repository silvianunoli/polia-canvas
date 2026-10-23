import { describe, expect, it } from "vitest";
import { custoDoKit, kitsQueDaPraMontar, validarKit, type ProdutoParaKit } from "./kits";

const produto = (id: string, extra: Partial<ProdutoParaKit> = {}): ProdutoParaKit => ({
  id,
  nome: id,
  precoCusto: 10,
  controlaEstoque: true,
  skus: [{ id: `${id}-padrao`, variacao: null, saldo: 10 }],
  ...extra,
});

describe("kitsQueDaPraMontar", () => {
  it("é o menor saldo dividido pela quantidade", () => {
    const mapa = new Map([
      ["caneca", produto("caneca", { skus: [{ id: "c", variacao: null, saldo: 8 }] })],
      ["vela", produto("vela", { skus: [{ id: "v", variacao: null, saldo: 5 }] })],
    ]);
    expect(
      kitsQueDaPraMontar(
        [
          { componenteId: "caneca", skuId: null, quantidade: 1 },
          { componenteId: "vela", skuId: null, quantidade: 2 },
        ],
        mapa,
      ),
    ).toBe(2);
  });
  it("usa a variação escolhida e trata saldo negativo como zero", () => {
    const mapa = new Map([
      [
        "camiseta",
        produto("camiseta", {
          skus: [
            { id: "p", variacao: "P", saldo: -2 },
            { id: "g", variacao: "G", saldo: 7 },
          ],
        }),
      ],
    ]);
    expect(
      kitsQueDaPraMontar([{ componenteId: "camiseta", skuId: "g", quantidade: 3 }], mapa),
    ).toBe(2);
    expect(
      kitsQueDaPraMontar([{ componenteId: "camiseta", skuId: "p", quantidade: 1 }], mapa),
    ).toBe(0);
  });
  it("quantidade apagada no meio da digitação não conta", () => {
    const mapa = new Map([["a", produto("a")]]);
    expect(
      kitsQueDaPraMontar([{ componenteId: "a", skuId: null, quantidade: 0 }], mapa),
    ).toBeNull();
    expect(custoDoKit([{ componenteId: "a", skuId: null, quantidade: 0 }], mapa)).toBeNull();
  });
  it("sem componente com estoque ligado não há limite", () => {
    const mapa = new Map([["ebook", produto("ebook", { controlaEstoque: false })]]);
    expect(
      kitsQueDaPraMontar([{ componenteId: "ebook", skuId: null, quantidade: 1 }], mapa),
    ).toBeNull();
  });
});

describe("custoDoKit", () => {
  it("soma quantidade x custo, e some sem custo de algum", () => {
    const mapa = new Map([
      ["a", produto("a", { precoCusto: 20 })],
      ["b", produto("b", { precoCusto: 8 })],
      ["c", produto("c", { precoCusto: null })],
    ]);
    expect(
      custoDoKit(
        [
          { componenteId: "a", skuId: null, quantidade: 1 },
          { componenteId: "b", skuId: null, quantidade: 2 },
        ],
        mapa,
      ),
    ).toBe(36);
    expect(custoDoKit([{ componenteId: "c", skuId: null, quantidade: 1 }], mapa)).toBeNull();
    expect(custoDoKit([], mapa)).toBeNull();
  });
});

describe("validarKit", () => {
  const precisa = (id: string) => id === "camiseta";
  it("pega lista vazia, quantidade, variação faltando e repetição", () => {
    expect(validarKit([], precisa)).toBe("vazio");
    expect(validarKit([{ componenteId: "a", skuId: null, quantidade: 0 }], precisa)).toBe(
      "quantidade",
    );
    expect(validarKit([{ componenteId: "camiseta", skuId: null, quantidade: 1 }], precisa)).toBe(
      "variacao",
    );
    expect(
      validarKit(
        [
          { componenteId: "a", skuId: null, quantidade: 1 },
          { componenteId: "a", skuId: null, quantidade: 2 },
        ],
        precisa,
      ),
    ).toBe("repetido");
    expect(
      validarKit([{ componenteId: "camiseta", skuId: "g", quantidade: 1 }], precisa),
    ).toBeNull();
  });
});
