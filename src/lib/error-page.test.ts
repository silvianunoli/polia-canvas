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
    expect(html).toContain("This page didn't load");
    expect(html).toContain("Something went wrong on our end.");
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
