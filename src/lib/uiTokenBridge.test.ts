import { describe, it, expect } from "vitest";
import { TOKEN_BRIDGE_V3 } from "./uiTokenBridge";

// A ponte existe porque componentes portalados pro body saem da árvore
// .polia-v3 e perdem os tokens. Se alguém puser hex aqui, a paleta v1
// (creme/marrom) volta pela porta dos fundos.
describe("TOKEN_BRIDGE_V3", () => {
  const entradas = Object.entries(TOKEN_BRIDGE_V3 as Record<string, string>);

  it("só define custom properties (chaves começam com --)", () => {
    expect(entradas.length).toBeGreaterThan(0);
    for (const [chave] of entradas) expect(chave).toMatch(/^--/);
  });

  it("todo valor aponta pra um token v3 via var(--...), exceto o branco puro", () => {
    for (const [chave, valor] of entradas) {
      expect(valor, chave).toMatch(/^(var\(--[a-z-]+\)|#ffffff)$/i);
    }
  });

  it("remapeia --primary (shadcn) pra turquesa e --accent pra superfície, nunca pro pêssego", () => {
    const b = TOKEN_BRIDGE_V3 as Record<string, string>;
    expect(b["--primary"]).toBe("var(--secondary)");
    expect(b["--primary-foreground"]).toBe("var(--secondary-ink)");
    expect(b["--accent"]).toBe("var(--surface)");
  });
});
