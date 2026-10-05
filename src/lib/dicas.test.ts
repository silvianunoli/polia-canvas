import { describe, expect, it } from "vitest";

import { PASSOS_TOUR, TEXTO_DICA, deveMostrar, esquecerVista, marcarVista } from "./dicas";

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
  it("tem 3 balões, com o Planejamento primeiro", () => {
    expect(PASSOS_TOUR).toHaveLength(3);
    expect(PASSOS_TOUR[0].alvo).toBe("planejamento");
  });

  it("chama o produto de Pólia One quando fala dele pelo nome", () => {
    const textos = [...PASSOS_TOUR.map((p) => p.texto), ...Object.values(TEXTO_DICA)];
    for (const t of textos) expect(t).not.toMatch(/Pólia(?! One)/);
  });
});
