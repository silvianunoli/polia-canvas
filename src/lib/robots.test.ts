import { describe, expect, it } from "vitest";
import { CORPO_ROBOTS } from "./robots";

// Os 9 rastreadores de IA que o robots.txt gerenciado da Cloudflare bloqueava.
// Se algum sumir daqui numa edição futura, o teste quebra antes do deploy.
const AGENTES_BLOQUEADOS = [
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "CloudflareBrowserRenderingCrawler",
  "Google-Extended",
  "GPTBot",
  "meta-externalagent",
];

describe("CORPO_ROBOTS", () => {
  it("aponta pro sitemap no domínio próprio", () => {
    expect(CORPO_ROBOTS).toContain("Sitemap: https://usepolia.com.br/sitemap.xml");
    expect(CORPO_ROBOTS).not.toContain("workers.dev");
  });

  it("preserva o Content-Signal da Cloudflare", () => {
    expect(CORPO_ROBOTS).toContain("Content-Signal: search=yes,ai-train=no,use=reference");
  });

  it("libera o rastreamento geral", () => {
    expect(CORPO_ROBOTS).toContain("User-agent: *");
    expect(CORPO_ROBOTS).toContain("Allow: /");
  });

  it("mantém os 9 rastreadores de IA bloqueados", () => {
    for (const agente of AGENTES_BLOQUEADOS) {
      expect(CORPO_ROBOTS).toContain(`User-agent: ${agente}\nDisallow: /`);
    }
    expect(CORPO_ROBOTS.match(/^Disallow: \//gm)).toHaveLength(AGENTES_BLOQUEADOS.length);
  });
});
