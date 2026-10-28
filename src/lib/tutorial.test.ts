import { describe, expect, it } from "vitest";

import { htmlEmbutido, lerMensagemTutorial } from "./tutorial";

describe("vídeo embutido", () => {
  it("liga o modo embutido no <html>", () => {
    expect(htmlEmbutido('<!doctype html>\n<html lang="pt-BR">\n<head>')).toContain(
      '<html lang="pt-BR" class="embed">',
    );
  });

  it("marca o trecho da ferramenta e ignora valor fora do formato", () => {
    const html = '<html lang="pt-BR">';
    expect(htmlEmbutido(html, "financeiro")).toBe(
      '<html lang="pt-BR" class="embed" data-trecho="financeiro">',
    );
    expect(htmlEmbutido(html, "senha-o5")).toContain('data-trecho="senha-o5"');
    expect(htmlEmbutido(html, '"><script>')).toBe('<html lang="pt-BR" class="embed">');
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
