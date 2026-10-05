import { describe, expect, it } from "vitest";

import { avisoCotaEsgotada, pertoDoLimite } from "./usoIa";

describe("avisoCotaEsgotada", () => {
  it("Grátis aponta o Premium", () => {
    expect(avisoCotaEsgotada("confere").upgrade?.tier).toBe("controle");
  });

  it("Premium aponta o Pro", () => {
    expect(avisoCotaEsgotada("controle").upgrade?.tier).toBe("projete");
  });

  it("Pro não manda assinar nada, só avisa quando renova", () => {
    const a = avisoCotaEsgotada("projete");
    expect(a.upgrade).toBeUndefined();
    expect(a.texto).toMatch(/renova/);
  });
});

describe("pertoDoLimite", () => {
  it("avisa quando sobra 20% ou menos", () => {
    expect(pertoDoLimite(48, 60)).toBe(true);
    expect(pertoDoLimite(47, 60)).toBe(false);
  });

  it("no Grátis (1 uso) não avisa antes de usar e não avisa depois de esgotar", () => {
    expect(pertoDoLimite(0, 1)).toBe(false);
    expect(pertoDoLimite(1, 1)).toBe(false);
  });
});
