import { describe, expect, it } from "vitest";

import { SECOES, secoesDoModulo } from "./planejamento";
import { chamadaDoPlanejamento, estagioPainel, itensPraAcender } from "./painelAcende";

const ids = (...modulos: number[]) =>
  new Set(modulos.flatMap((n) => secoesDoModulo(n).map((s) => s.id)));

describe("estagioPainel", () => {
  it("conta nova fica no Planejamento, Módulo 1", () => {
    const e = estagioPainel(new Set());
    expect(e).toMatchObject({ tipo: "planejamento", modulo: 1, feitas: 0 });
  });

  it("com os Módulos 1 a 3 fechados aponta o Módulo 4", () => {
    expect(estagioPainel(ids(1, 2, 3))).toMatchObject({ tipo: "planejamento", modulo: 4 });
  });

  it("com o Módulo 4 fechado vai pros números, mesmo com 5 e 6 em aberto", () => {
    expect(estagioPainel(ids(1, 2, 3, 4))).toEqual({ tipo: "numeros" });
  });

  it("com tudo fechado também fica nos números", () => {
    expect(estagioPainel(new Set(SECOES.map((s) => s.id)))).toEqual({ tipo: "numeros" });
  });
});

describe("chamadaDoPlanejamento", () => {
  it("Módulo 1 sem nada feito diz quantas seções são", () => {
    const e = estagioPainel(new Set());
    if (e.tipo !== "planejamento") throw new Error("estágio errado");
    const c = chamadaDoPlanejamento(e);
    expect(c.manchete).toContain(`${secoesDoModulo(1).length} seções curtas`);
    expect(c.acao).toBe("Quero começar o Módulo 1");
  });

  it("Módulo 1 pela metade conta o que falta", () => {
    const e = estagioPainel(new Set([secoesDoModulo(1)[0].id]));
    if (e.tipo !== "planejamento") throw new Error("estágio errado");
    const c = chamadaDoPlanejamento(e);
    expect(c.manchete).toMatch(/1 de \d+ seções/);
    expect(c.acao).toBe("Quero continuar o Módulo 1");
  });

  it("Módulo 4 fala da conta do mês", () => {
    const e = estagioPainel(ids(1, 2, 3));
    if (e.tipo !== "planejamento") throw new Error("estágio errado");
    const c = chamadaDoPlanejamento(e);
    expect(c.manchete).toContain("conta do mês");
    expect(c.acao).toBe("Quero abrir o Módulo 4");
  });

  it("nenhuma chamada usa vocabulário morto, exclamação ou travessão", () => {
    const estagios = [new Set<string>(), ids(1), ids(1, 2), ids(1, 2, 3)].map(estagioPainel);
    for (const e of estagios) {
      if (e.tipo !== "planejamento") continue;
      const { manchete, acao } = chamadaDoPlanejamento(e);
      for (const t of [manchete, acao]) {
        expect(t).not.toMatch(/etapa|trilha|jornada|!|—/i);
        expect(t).not.toMatch(/^Você/);
      }
    }
  });
});

describe("itensPraAcender", () => {
  it("conta nova começa com 2 de 6 feitos", () => {
    const itens = itensPraAcender(new Set(), false);
    expect(itens).toHaveLength(6);
    expect(itens.filter((i) => i.feito)).toHaveLength(2);
  });

  it("entrada e módulos marcam cada item pelo que de fato aconteceu", () => {
    const itens = itensPraAcender(ids(1, 2, 3, 4), true);
    const feito = Object.fromEntries(itens.map((i) => [i.id, i.feito]));
    expect(feito).toMatchObject({
      "modulo-1": true,
      "modulo-4": true,
      entrada: true,
      completo: false,
    });
  });

  it("fica tudo feito com os 6 módulos e uma entrada", () => {
    const itens = itensPraAcender(new Set(SECOES.map((s) => s.id)), true);
    expect(itens.every((i) => i.feito)).toBe(true);
  });
});
