import { describe, expect, it } from "vitest";
import { ofertaFundadoraAtiva, textoFundadora, vagasRestantes, VAGAS_FUNDADORA } from "./fundadora";

const antes = Date.parse("2026-10-20T12:00:00-03:00");
const depois = Date.parse("2026-12-01T00:00:01-03:00");

describe("preço de fundadora", () => {
  it("vagas nunca negativas", () => {
    expect(vagasRestantes(2)).toBe(VAGAS_FUNDADORA - 2);
    expect(vagasRestantes(80)).toBe(0);
    expect(vagasRestantes(-3)).toBe(VAGAS_FUNDADORA);
  });
  it("ativa só no prazo e com vaga", () => {
    expect(ofertaFundadoraAtiva(2, antes)).toBe(true);
    expect(ofertaFundadoraAtiva(2, depois)).toBe(false);
    expect(ofertaFundadoraAtiva(VAGAS_FUNDADORA, antes)).toBe(false);
  });
  it("texto com prazo, preços e vagas, sem travessão nem exclamação", () => {
    const t = textoFundadora(2, antes)!;
    expect(t.texto).toContain("30/11");
    expect(t.texto).toContain("29,90");
    expect(t.texto).toContain("47,90");
    expect(t.vagas).toBe("Restam 48 das 50 vagas.");
    expect(`${t.rotulo} ${t.texto} ${t.vagas}`).not.toMatch(/[—–!]/);
    expect(textoFundadora(49, antes)!.vagas).toBe("Resta 1 vaga.");
    expect(textoFundadora(2, depois)).toBeNull();
  });
});
