import { describe, expect, it } from "vitest";
import { precoQueVale, promocionalQueVale } from "./precoPromocional";

describe("preço promocional (ONE-239)", () => {
  it("o promocional vale quando é menor que o preço de venda", () => {
    expect(promocionalQueVale(120, "56.9")).toBe(56.9);
    expect(precoQueVale("120", 56.9)).toBe(56.9);
  });

  it("igual, maior, zero ou vazio não vale: fica o preço de venda", () => {
    expect(precoQueVale(120, 120)).toBe(120);
    expect(precoQueVale(120, 150)).toBe(120);
    expect(precoQueVale(120, 0)).toBe(120);
    expect(precoQueVale(120, null)).toBe(120);
    expect(precoQueVale(120, "")).toBe(120);
    expect(promocionalQueVale(120, undefined)).toBeNull();
  });

  it("sem preço de venda, nada de promoção", () => {
    expect(promocionalQueVale(null, 10)).toBeNull();
    expect(precoQueVale(null, 10)).toBe(0);
  });
});
