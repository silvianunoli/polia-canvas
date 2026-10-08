import { describe, expect, it } from "vitest";

import { htmlEmbutido, lerMensagemTutorial, rotaAceitaConvite } from "./tutorial";

describe("convite do tutorial", () => {
  it("não abre no fluxo de entrada, no upgrade nem no próprio tutorial", () => {
    expect(rotaAceitaConvite("/onboarding")).toBe(false);
    expect(rotaAceitaConvite("/assinar")).toBe(false);
    expect(rotaAceitaConvite("/upgrade")).toBe(false);
    expect(rotaAceitaConvite("/como-usar")).toBe(false);
  });

  it("não abre na Calculadora, onde o onboarding termina (ONE-101)", () => {
    expect(rotaAceitaConvite("/calculadora")).toBe(false);
  });

  it("abre na primeira tela seguinte da área logada", () => {
    expect(rotaAceitaConvite("/painel")).toBe(true);
    expect(rotaAceitaConvite("/planejamento/modulo/1")).toBe(true);
  });

  it("não confunde rota parecida com a do tutorial", () => {
    expect(rotaAceitaConvite("/como-usar-antigo")).toBe(true);
  });
});

describe("vídeo embutido", () => {
  it("liga o modo embutido no <html>", () => {
    expect(htmlEmbutido('<!doctype html>\n<html lang="pt-BR">\n<head>')).toContain(
      '<html lang="pt-BR" class="embed">',
    );
  });

  it("aceita a altura do iframe só quando é plausível", () => {
    expect(lerMensagemTutorial({ tipo: "polia-tutorial-altura", altura: 812.4 })).toEqual({
      tipo: "altura",
      altura: 813,
    });
    expect(lerMensagemTutorial({ tipo: "polia-tutorial-altura", altura: 50 })).toBeNull();
    expect(lerMensagemTutorial({ tipo: "polia-tutorial-altura", altura: "800" })).toBeNull();
  });

  it("aceita só os eventos conhecidos", () => {
    expect(lerMensagemTutorial({ tipo: "polia-tutorial-evento", evento: "play" })).toEqual({
      tipo: "evento",
      evento: "play",
    });
    expect(lerMensagemTutorial({ tipo: "polia-tutorial-evento", evento: "hack" })).toBeNull();
    expect(lerMensagemTutorial({ tipo: "polia-tutorial-cheia", ativo: true })).toEqual({
      tipo: "cheia",
      ativo: true,
    });
    expect(lerMensagemTutorial({ tipo: "polia-tutorial-cheia", ativo: "sim" })).toBeNull();
    expect(lerMensagemTutorial("oi")).toBeNull();
    expect(lerMensagemTutorial(null)).toBeNull();
  });
});
