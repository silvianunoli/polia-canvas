import { describe, expect, it } from "vitest";
import { CAMINHOS_ESTATICOS, montarSitemap } from "./sitemap";

describe("montarSitemap", () => {
  it("devolve só as URLs estáticas quando não tem post", () => {
    const xml = montarSitemap([]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    for (const caminho of CAMINHOS_ESTATICOS) {
      expect(xml).toContain(`<loc>https://usepolia.com.br${caminho}</loc>`);
    }
    expect(xml.match(/<url>/g)).toHaveLength(CAMINHOS_ESTATICOS.length);
    // Data inventada é pior que data ausente: estática nenhuma leva lastmod.
    expect(xml).not.toContain("<lastmod>");
  });

  it("nunca aponta pro subdomínio workers.dev", () => {
    const xml = montarSitemap([{ slug: "preco-no-chute", publicado_em: "2026-08-01T12:00:00Z" }]);

    expect(xml).not.toContain("workers.dev");
    expect(xml.match(/<loc>https:\/\/usepolia\.com\.br/g)).toHaveLength(
      CAMINHOS_ESTATICOS.length + 1,
    );
  });

  it("inclui os posts com lastmod vindo de publicado_em", () => {
    const xml = montarSitemap([
      { slug: "preco-no-chute", publicado_em: "2026-08-01T12:00:00Z" },
      { slug: "quanto-sobra", publicado_em: "2026-07-15T09:30:00Z" },
    ]);

    expect(xml).toContain("<loc>https://usepolia.com.br/blog/preco-no-chute</loc>");
    expect(xml).toContain("<lastmod>2026-08-01</lastmod>");
    expect(xml).toContain("<loc>https://usepolia.com.br/blog/quanto-sobra</loc>");
    expect(xml).toContain("<lastmod>2026-07-15</lastmod>");
    expect(xml.match(/<url>/g)).toHaveLength(CAMINHOS_ESTATICOS.length + 2);
  });

  it("omite lastmod quando publicado_em é nulo ou inválido", () => {
    const xml = montarSitemap([
      { slug: "sem-data", publicado_em: null },
      { slug: "data-torta", publicado_em: "nao-e-data" },
    ]);

    expect(xml).toContain("<loc>https://usepolia.com.br/blog/sem-data</loc>");
    expect(xml).toContain("<loc>https://usepolia.com.br/blog/data-torta</loc>");
    expect(xml).not.toContain("<lastmod>");
  });

  it("escapa caractere especial no slug", () => {
    const xml = montarSitemap([{ slug: 'preco & lucro <"tudo">', publicado_em: null }]);

    expect(xml).toContain(
      "<loc>https://usepolia.com.br/blog/preco &amp; lucro &lt;&quot;tudo&quot;&gt;</loc>",
    );
    // O "&" cru quebraria o documento inteiro, e sitemap malformado o Google
    // descarta por completo.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});
