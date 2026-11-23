import { describe, expect, it } from "vitest";
import { FORMAS_SAIDA, formasDoTipo, formaValidaPara } from "./formas";

describe("formas por tipo", () => {
  it("boleto só existe na saída", () => {
    expect(formasDoTipo("saida")).toContain("boleto");
    expect(formasDoTipo("entrada")).not.toContain("boleto");
    expect(FORMAS_SAIDA[0]).toBe("pix");
  });
  it("forma que não serve pro tipo vira vazio", () => {
    expect(formaValidaPara("entrada", "boleto")).toBe("");
    expect(formaValidaPara("saida", "boleto")).toBe("boleto");
    expect(formaValidaPara("entrada", "pix")).toBe("pix");
    expect(formaValidaPara("saida", null)).toBe("");
    expect(formaValidaPara("saida", "voucher")).toBe("");
  });
});
