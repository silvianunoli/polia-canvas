import { describe, expect, it } from "vitest";
import { fraseDoGanho } from "./ganhoDoUpgrade";

describe("fraseDoGanho", () => {
  it("Raio-x, Projeção, Encomenda e Resumo nomeiam o plano que a tela pede (Premium depois de 01/12)", () => {
    expect(fraseDoGanho("/raiox", "Premium")).toBe(
      "O Premium lê o seu mês e devolve onde o dinheiro está vazando.",
    );
    for (const rota of ["/projecao", "/calculadora", "/financeiro/resumo"]) {
      expect(fraseDoGanho(rota, "Premium")).toMatch(/^O Premium /);
      expect(fraseDoGanho(rota, "Premium")).not.toContain("{plano}");
    }
  });

  it("tela conhecida tem frase própria", () => {
    expect(fraseDoGanho("/raiox", "Pro")).toBe(
      "O Pro lê o seu mês e devolve onde o dinheiro está vazando.",
    );
  });

  it("tela com limite no Grátis fala em limite, não em abrir", () => {
    expect(fraseDoGanho("/planejamento/modulo/2", "Premium")).toBe("O Premium aumenta o limite.");
  });

  it("sem tela conhecida cai na frase geral do plano", () => {
    expect(fraseDoGanho(undefined, "Premium")).toBe(
      "Assinando o Premium, essa tela abre na sua conta na hora.",
    );
    expect(fraseDoGanho("/qualquer", "Pro")).toBe(
      "Assinando o Pro, essa tela abre na sua conta na hora.",
    );
  });

  it("nenhuma frase usa nome de plano morto, travessão ou exclamação", () => {
    for (const rota of ["/raiox", "/financeiro", "/caderno", "/x"]) {
      expect(fraseDoGanho(rota, "Pro")).not.toMatch(/Confere|Controle|Projete|—|!/);
    }
  });
});
