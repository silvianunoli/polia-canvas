import { describe, expect, it } from "vitest";

import {
  DESTINO_SEM_ACESSO,
  rotaBloqueadaSemFlag,
  rotaVisivel,
  SEM_ACESSO_INTERNO,
} from "./ferramentasInternas";

describe("ferramentas internas (Planner, Caderno e Planejamento só pra conta interna)", () => {
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

  it("Planejamento, Marca e Mercado saem das usuárias (31/10/2026) e levam pro Painel", () => {
    for (const rota of [
      "/planejamento",
      "/planejamento/modulo/1",
      "/planejamento/completo",
      "/marca",
      "/mercado",
    ]) {
      expect(rotaBloqueadaSemFlag(rota), rota).toBe("planejamento");
    }
    expect(DESTINO_SEM_ACESSO.planejamento).toBe("/painel");
    // Prefixo parecido não é a mesma rota.
    expect(rotaBloqueadaSemFlag("/marcas")).toBeNull();
    expect(rotaBloqueadaSemFlag("/mercadolivre")).toBeNull();
    expect(rotaBloqueadaSemFlag("/configuracoes/integracoes/mercado-livre")).toBeNull();
  });

  it("menu: sem a flag, Planner, Caderno e Planejamento somem; com a flag, aparecem; o resto sempre", () => {
    expect(rotaVisivel("/planner", SEM_ACESSO_INTERNO)).toBe(false);
    expect(rotaVisivel("/caderno", SEM_ACESSO_INTERNO)).toBe(false);
    expect(rotaVisivel("/planejamento", SEM_ACESSO_INTERNO)).toBe(false);
    expect(rotaVisivel("/planner", { ...SEM_ACESSO_INTERNO, planner: true })).toBe(true);
    expect(rotaVisivel("/caderno", { ...SEM_ACESSO_INTERNO, planner: true })).toBe(false);
    expect(rotaVisivel("/planejamento", { ...SEM_ACESSO_INTERNO, planejamento: true })).toBe(true);
    expect(rotaVisivel("/vendas", SEM_ACESSO_INTERNO)).toBe(true);
    expect(rotaVisivel("/pedidos", SEM_ACESSO_INTERNO)).toBe(true);
  });
});
