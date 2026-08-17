// robots.txt do site público, servido pelo Worker (ver o handler em src/server.ts).
//
// O corpo abaixo é cópia literal do que a Cloudflare gerava em produção
// (robots.txt gerenciado, capturado em 17/08/2026): os sinais de conteúdo,
// os 9 rastreadores de IA bloqueados e o Allow do User-agent "*". A única
// diferença é a linha Sitemap no fim, que o arquivo gerenciado não tem e é
// justamente o que o Google usa pra descobrir as URLs.
//
// ATENÇÃO: a Cloudflare pode continuar sobrescrevendo isso no edge. Se ela
// vencer depois do deploy, a linha Sitemap precisa entrar pelo painel dela,
// não por código. Não contorne a Cloudflare aqui.

const SITEMAP = "https://usepolia.com.br/sitemap.xml";

export const CORPO_ROBOTS = `# As a condition of accessing this website, you agree to abide by the following
# content signals:

# (a)  If a Content-Signal = yes, you may collect content for the corresponding
#      use.
# (b)  If a Content-Signal = no, you may not collect content for the
#      corresponding use.
# (c)  If the website operator does not include a Content-Signal for a
#      corresponding use, the website operator neither grants nor restricts
#      permission via Content-Signal with respect to the corresponding use.

# The content signals and their meanings are:

# search:   building a search index and providing search results (e.g., returning
#           hyperlinks and short excerpts from your website's contents). Search does not
#           include providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models (e.g., retrieval
#           augmented generation, grounding, or other real-time taking of content for
#           generative AI search answers).
# ai-train: training or fine-tuning AI models.
# use:      how AI systems may consume the content (immediate, reference, or full).

# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT
# AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET.

# BEGIN Cloudflare Managed content

User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CloudflareBrowserRenderingCrawler
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

# END Cloudflare Managed Content

Sitemap: ${SITEMAP}
`;
