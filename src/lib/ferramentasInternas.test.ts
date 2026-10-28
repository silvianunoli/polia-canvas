import { describe, expect, it } from "vitest";

import { rotaBloqueadaSemFlag, rotaVisivel, SEM_ACESSO_INTERNO } from "./ferramentasInternas";

describe("ferramentas internas (Planner e Caderno só pra conta interna)", () => {
  it("a guarda bloqueia o Planner inteiro, com e sem subcaminho", () => {
    expect(rotaBloqueadaSemFlag("/planner")).toBe("planner");
    expect(rotaBloqueadaSemFlag("/planner/feira")).toBe("planner");
  });

  it("Pedidos, o antigo /planner/pedidos e o Caderno não são bloqueados", () => {
    expect(rotaBloqueadaSemFlag("/pedidos")).toBeNull();
    expect(rotaBloqueadaSemFlag("/planner/pedidos")).toBeNull();
    expect(rotaBloqueadaSemFlag("/plannerx")).toBeNull();
    // O guia de presença do Módulo 5 mora no /caderno: a tela abre pra todas.
    expect(rotaBloqueadaSemFlag("/caderno")).toBeNull();
  });

  it("menu: sem a flag, Planner e Caderno somem; com a flag, aparecem; o resto sempre", () => {
    expect(rotaVisivel("/planner", SEM_ACESSO_INTERNO)).toBe(false);
    expect(rotaVisivel("/caderno", SEM_ACESSO_INTERNO)).toBe(false);
    expect(rotaVisivel("/planner", { planner: true, caderno: false })).toBe(true);
    expect(rotaVisivel("/caderno", { planner: true, caderno: false })).toBe(false);
    expect(rotaVisivel("/vendas", SEM_ACESSO_INTERNO)).toBe(true);
    expect(rotaVisivel("/pedidos", SEM_ACESSO_INTERNO)).toBe(true);
  });
});
