import { describe, it, expect } from "vitest";
import {
  LIMITE_RAIOX_MENSAL,
  avisoDoMotivoRaioX,
  planoGeraRaioX,
  type MotivoRaioX,
} from "./raioxMotivo";

describe("planoGeraRaioX (QA-30)", () => {
  it("Pro e beta geram; Grátis, Premium, cancelada e sem plano não", () => {
    expect(planoGeraRaioX("projete")).toBe(true);
    expect(planoGeraRaioX("beta")).toBe(true);
    expect(planoGeraRaioX("controle")).toBe(false);
    expect(planoGeraRaioX("confere")).toBe(false);
    expect(planoGeraRaioX("cancelada")).toBe(false);
    expect(planoGeraRaioX(null)).toBe(false);
    expect(planoGeraRaioX(undefined)).toBe(false);
  });
});

describe("avisoDoMotivoRaioX (QA-30)", () => {
  const motivos: MotivoRaioX[] = [
    "manutencao",
    "teto_atingido",
    "falha_ia",
    "dado_insuficiente",
    "mes_nao_fechado",
    "plano_insuficiente",
  ];

  it("todo motivo tem texto, sem travessão nem exclamação", () => {
    for (const m of motivos) {
      const t = avisoDoMotivoRaioX(m);
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toMatch(/[—–!]/);
    }
  });

  it("o teto escreve o limite", () => {
    expect(avisoDoMotivoRaioX("teto_atingido")).toContain(String(LIMITE_RAIOX_MENSAL));
  });
});
