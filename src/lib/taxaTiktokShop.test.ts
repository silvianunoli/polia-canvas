import { describe, it, expect } from "vitest";
import {
  descreverTabelaTiktok,
  taxaTiktokDaVenda,
  taxaTiktokDoItem,
} from "../../supabase/functions/_shared/taxaTiktokShop";

describe("taxaTiktokDoItem", () => {
  it("abaixo de R$ 50: 10% + R$ 4", () => {
    expect(taxaTiktokDoItem(29.9)).toBe(6.99);
    expect(taxaTiktokDoItem(49.99)).toBe(9);
  });

  it("de R$ 50 pra cima: 6% + R$ 6", () => {
    expect(taxaTiktokDoItem(50)).toBe(9);
    expect(taxaTiktokDoItem(119.7)).toBe(13.18);
  });

  it("Frete Grátis soma 6% do item, com teto de R$ 50", () => {
    expect(taxaTiktokDoItem(29.9, { freteGratis: true })).toBe(8.78);
    // 6% de R$ 1.000 = R$ 60, limitado a R$ 50.
    expect(taxaTiktokDoItem(1000, { freteGratis: true })).toBe(116);
  });

  it("nunca passa do preço do item e preço zero não cobra", () => {
    expect(taxaTiktokDoItem(3)).toBe(3);
    expect(taxaTiktokDoItem(0)).toBe(0);
  });
});

describe("taxaTiktokDaVenda", () => {
  it("cobra por unidade, cada uma na faixa do próprio preço", () => {
    const taxa = taxaTiktokDaVenda([
      { preco_unitario: 39.9, quantidade: 3 }, // 3 x (3,99 + 4)
      { preco_unitario: 80, quantidade: 1 }, // 4,80 + 6
    ]);
    expect(taxa).toBe(34.77);
  });

  it("quantidade zero ou quebrada não cobra a mais", () => {
    expect(taxaTiktokDaVenda([{ preco_unitario: 39.9, quantidade: 0 }])).toBe(0);
    expect(taxaTiktokDaVenda([{ preco_unitario: 39.9, quantidade: 1.7 }])).toBe(7.99);
  });
});

describe("descreverTabelaTiktok", () => {
  it("diz as duas faixas e o Frete Grátis quando ligado", () => {
    expect(descreverTabelaTiktok()).toBe(
      "10% + R$ 4 por item abaixo de R$ 50; 6% + R$ 6 a partir de R$ 50",
    );
    expect(descreverTabelaTiktok(true)).toMatch(/mais 6% do Frete Grátis$/);
  });
});
