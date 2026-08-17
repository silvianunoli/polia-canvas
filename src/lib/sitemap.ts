// Sitemap do site público, servido pelo Worker (ver o handler em src/server.ts).
// A montagem do XML mora aqui, separada do transporte, pra ser testável sem
// subir servidor nem mockar Supabase.

// Host fixo de propósito, NUNCA derivado do request: o site também responde no
// subdomínio *.workers.dev (fallback operacional mantido no wrangler.jsonc), e
// um sitemap derivado do request apontaria pra lá, criando índice duplicado.
// Fonte única do host: src/lib/seo.ts.
import { HOST_CANONICO } from "./seo";

export { HOST_CANONICO };

// URLs públicas estáticas, nesta ordem. Ficam de fora, por não serem conteúdo
// indexável: /central, /auth/*, /pesquisa, /compra-confirmada, /descadastrar e
// tudo que exige login.
export const CAMINHOS_ESTATICOS = [
  "/",
  "/sobre",
  "/ajuda",
  "/blog",
  "/quiz",
  "/lista-de-espera",
  "/termos",
  "/privacidade",
] as const;

export type PostSitemap = {
  slug: string;
  publicado_em: string | null;
};

/**
 * Escapa as cinco entidades XML. O slug vem do CMS e em tese é kebab-case, mas
 * um "&" solto num slug quebraria o documento inteiro, e sitemap malformado o
 * Google descarta por completo.
 */
function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Data no formato W3C (YYYY-MM-DD). Data inválida vira ausência de lastmod. */
function formatarLastmod(valor: string | null): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString().slice(0, 10);
}

export function montarSitemap(posts: PostSitemap[]): string {
  const urls = [
    // Estáticas sem <lastmod>: data inventada é pior que data ausente.
    ...CAMINHOS_ESTATICOS.map((caminho) => ({
      loc: `${HOST_CANONICO}${caminho}`,
      lastmod: null as string | null,
    })),
    ...posts.map((post) => ({
      loc: `${HOST_CANONICO}/blog/${post.slug}`,
      lastmod: formatarLastmod(post.publicado_em),
    })),
  ];

  const corpo = urls
    .map(({ loc, lastmod }) => {
      const linhas = [`    <loc>${escaparXml(loc)}</loc>`];
      if (lastmod) linhas.push(`    <lastmod>${lastmod}</lastmod>`);
      return `  <url>\n${linhas.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${corpo}\n</urlset>\n`;
}
