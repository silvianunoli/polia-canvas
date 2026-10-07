import { describe, it, expect } from "vitest";
import { renderErrorPage } from "./error-page";

describe("renderErrorPage", () => {
  it("retorna um documento HTML5 válido (doctype + html + head + body)", () => {
    const html = renderErrorPage();
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
  });

  it("inclui o título e a mensagem de erro pro usuário", () => {
    const html = renderErrorPage();
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain("Essa página não carregou");
    expect(html).toContain("A Pólia não conseguiu abrir esta página.");
  });

  it("só usa cor da paleta da Pólia", () => {
    const paleta = ["#F2F0ED", "#0A0A0A", "#6B6B6B", "#E6E6E6", "#FFFFFF"];
    const hexes = [...new Set(renderErrorPage().match(/#[0-9A-Fa-f]{3,6}\b/g) ?? [])];
    expect(hexes.filter((h) => !paleta.includes(h.toUpperCase()))).toEqual([]);
  });

  it("inclui as duas ações de recuperação: tentar de novo e voltar pra home", () => {
    const html = renderErrorPage();
    expect(html).toContain('onclick="location.reload()"');
    expect(html).toContain('href="/"');
  });

  it("é determinística: duas chamadas retornam exatamente o mesmo HTML", () => {
    expect(renderErrorPage()).toBe(renderErrorPage());
  });
});
