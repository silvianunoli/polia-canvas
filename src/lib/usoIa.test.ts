import { describe, expect, it } from "vitest";

import {
  avisoCotaEsgotada,
  avisoTetoAssistente,
  LIMITE_DIARIO_ASSISTENTE,
  pertoDoLimite,
} from "./usoIa";

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

describe("avisoCotaEsgotada com plano cancelado", () => {
  it("cancelada é tratada como Grátis: oferece o Premium", () => {
    const a = avisoCotaEsgotada("cancelada");
    expect(a).toEqual(avisoCotaEsgotada("confere"));
    expect(a.upgrade?.tier).toBe("controle");
  });

  it("beta é acesso total: sem oferta", () => {
    expect(avisoCotaEsgotada("beta").upgrade).toBeUndefined();
  });
});

describe("avisoTetoAssistente", () => {
  it("Grátis e cancelada veem o Premium", () => {
    for (const plano of ["confere", "cancelada", null]) {
      const a = avisoTetoAssistente(plano);
      expect(a.upgrade).toEqual({ tier: "controle", rotulo: "Conhecer o Premium" });
      expect(a.texto).toContain("volta amanhã");
      expect(a.texto).toContain(`No Premium são ${LIMITE_DIARIO_ASSISTENTE.controle} por dia`);
    }
  });

  it("Premium vê o Pro, nunca o próprio Premium", () => {
    const a = avisoTetoAssistente("controle");
    expect(a.upgrade).toEqual({ tier: "projete", rotulo: "Conhecer o Pro" });
    expect(a.texto).not.toMatch(/No Premium/);
  });

  it("Pro e beta não recebem oferta, só o aviso de que volta amanhã", () => {
    for (const plano of ["projete", "beta"]) {
      const a = avisoTetoAssistente(plano);
      expect(a.upgrade).toBeUndefined();
      expect(a.texto).toBe("As perguntas de hoje já foram. O limite do dia volta amanhã.");
    }
  });

  it("nenhuma variação tem travessão nem exclamação", () => {
    for (const plano of ["confere", "controle", "projete"]) {
      expect(avisoTetoAssistente(plano).texto).not.toMatch(/[—–!]/);
    }
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
