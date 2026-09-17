import { describe, expect, it } from "vitest";
import { ambienteDoHost, featureDaRota, normalizarPagina } from "./founder-features";

describe("featureDaRota", () => {
  it("mapeia a rota e as subrotas pra mesma feature", () => {
    expect(featureDaRota("/produtos")).toBe("produtos");
    expect(featureDaRota("/planejamento/modulo/3")).toBe("planejamento");
    expect(featureDaRota("/plano-conteudo")).toBe("plano_conteudo");
  });

  it("não confunde prefixo com rota parecida", () => {
    expect(featureDaRota("/planner/semana")).toBe("planner");
    expect(featureDaRota("/planejamento")).toBe("planejamento");
    expect(featureDaRota("/rota-inexistente")).toBeNull();
  });
});

describe("normalizarPagina", () => {
  it("troca uuid e número de registro por marcador", () => {
    expect(normalizarPagina("/chamados/3f2a1b4c-1111-2222-3333-444455556666")).toBe(
      "/chamados/:id",
    );
    expect(normalizarPagina("/planejamento/modulo/3")).toBe("/planejamento/modulo/:n");
    expect(normalizarPagina("/painel")).toBe("/painel");
  });
});

describe("ambienteDoHost", () => {
  it("separa produção, preview e dev", () => {
    expect(ambienteDoHost("one.usepolia.com.br")).toBe("prod");
    expect(ambienteDoHost("polia-app.silvia.workers.dev")).toBe("preview");
    expect(ambienteDoHost("localhost")).toBe("dev");
  });
});
