import { describe, expect, it } from "vitest";
import { ehPlanoGratis } from "./planoGratis";

describe("ehPlanoGratis", () => {
  it("confere e cancelada são Grátis", () => {
    expect(ehPlanoGratis({ plano: "confere", carregando: false })).toBe(true);
    expect(ehPlanoGratis({ plano: "cancelada", carregando: false })).toBe(true);
  });

  it("Premium, Pro e beta não são", () => {
    expect(ehPlanoGratis({ plano: "controle", carregando: false })).toBe(false);
    expect(ehPlanoGratis({ plano: "projete", carregando: false })).toBe(false);
    expect(ehPlanoGratis({ plano: "beta", carregando: false })).toBe(false);
  });

  it("enquanto o perfil carrega, não trava ninguém", () => {
    expect(ehPlanoGratis({ plano: "confere", carregando: true })).toBe(false);
  });
});
