import { describe, expect, it } from "vitest";

import { secoesDoModulo } from "./planejamento";

import {
  BOAS_VINDAS,
  PASSOS_TOUR,
  TEXTO_DICA,
  TEXTO_DICA_PLANEJAMENTO,
  deveMostrar,
  esquecerVista,
  marcarVista,
} from "./dicas";

describe("dicas vistas", () => {
  it("marca sem duplicar", () => {
    expect(marcarVista([], "tour")).toEqual(["tour"]);
    expect(marcarVista(["tour"], "tour")).toEqual(["tour"]);
    expect(marcarVista(["tour"], "metas")).toEqual(["tour", "metas"]);
  });

  it("esquece só a chave pedida", () => {
    expect(esquecerVista(["tour", "metas"], "tour")).toEqual(["metas"]);
    expect(esquecerVista(["metas"], "tour")).toEqual(["metas"]);
  });

  it("não mostra enquanto a lista não chegou do banco", () => {
    expect(deveMostrar(undefined, "tour")).toBe(false);
  });

  it("mostra só o que ainda não foi visto", () => {
    expect(deveMostrar([], "tour")).toBe(true);
    expect(deveMostrar(["tour"], "tour")).toBe(false);
    expect(deveMostrar(["tour"], "metas")).toBe(true);
  });
});

describe("conteúdo do tour", () => {
  it("tem um balão só, apontando o Planejamento (ONE-112)", () => {
    expect(PASSOS_TOUR).toHaveLength(1);
    expect(PASSOS_TOUR[0].alvo).toBe("planejamento");
  });

  it("o balão diz o número real de seções do Módulo 1", () => {
    const n = secoesDoModulo(1).length;
    expect(PASSOS_TOUR[0].texto).toContain(`${n} seções`);
    expect(PASSOS_TOUR[0].textoSemAlvo).toContain(`${n} seções`);
  });

  it("chama o produto de Pólia One quando fala dele pelo nome", () => {
    const textos = [...PASSOS_TOUR.map((p) => p.texto), ...Object.values(TEXTO_DICA)];
    for (const t of textos) expect(t).not.toMatch(/Pólia(?! One)/);
  });

  it("boas-vindas e dicas do módulo seguem a voz: sem exclamação, travessão ou vocabulário morto", () => {
    const textos = [
      BOAS_VINDAS.titulo,
      ...BOAS_VINDAS.ciclo,
      BOAS_VINDAS.acao,
      ...Object.values(TEXTO_DICA_PLANEJAMENTO),
    ];
    for (const t of textos) {
      expect(t).not.toMatch(/!|—|etapa|trilha|jornada|transform/i);
      expect(t).not.toMatch(/Pólia(?! One)/);
    }
    expect(BOAS_VINDAS.acao).toMatch(/^Quero /);
  });
});
