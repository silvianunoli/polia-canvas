# Auditoria SEO técnica e on-page · Pólia (polia-app)

> Diagnóstico apenas. Nenhum arquivo foi alterado, nenhum commit foi feito.
> Base: código-fonte de `polia-app/` (branch de trabalho atual) + 1 consulta SQL de leitura no Supabase de produção (projeto "Pólia", tabela `blog_posts`, só `SELECT`). Onde não foi possível confirmar algo no ambiente disponível (Lighthouse, PageSpeed, GSC), está escrito explicitamente "Não foi possível determinar no ambiente atual."
> Domínio canônico: `https://usepolia.com.br` (fonte: [`src/lib/seo.ts`](../src/lib/seo.ts)).

---

## 1. Resumo executivo

O SEO técnico de base está bem construído — sitemap, robots.txt, canonical, `X-Robots-Tag` em rota autenticada e 301 de host tudo implementado com testes (`src/lib/robots.test.ts`, `src/lib/sitemap.test.ts`) e comentários explicando o porquê de cada decisão. O maior risco não é técnico, é de **conteúdo e cobertura de schema**:

- O blog está no ar, indexável, no sitemap — mas tem **zero posts publicados** (7 rascunhos no banco). É uma página de listagem vazia, indexável, hoje.
- **Nenhum artigo de blog tem schema `Article`/`BlogPosting`**, `author`, `datePublished` ou `breadcrumbs` estruturados — só o FAQ da home e Organization/WebSite globais existem.
- `/pesquisa` é servida sem nenhuma tag `robots` e sem estar no sitemap — sinal ambíguo: não bloqueada, mas também não anunciada. Se alguém linkar essa URL de fora, ela é indexável por omissão.
- `/manual` e `/quiz` (as duas iscas de captura de lead) **não recebem nenhum link interno** do site (não estão no header, footer, home nem blog) — dependem 100% de tráfego externo (bio do Instagram) e do sitemap para serem descobertas.
- Meta description da Home (192 caracteres) e do Manual (178) passam do limite prático de exibição no Google (~155-160) e devem truncar no snippet.

Fora isso, a fundação é sólida: SSR real (TanStack Start, não é SPA client-only), loader de blog busca dados no servidor (então o HTML que chega ao Googlebot já tem os links dos posts), único host canônico com 301 automático pra `www`/`workers.dev`, heading hierarchy limpa nas páginas institucionais, `Termos`/`Privacidade` com H1+H2 numerados e âncoras, e volume de imagem propositalmente baixo (a marca não usa fotos de banco, então o "custo" de imagem do site é mínimo).

## 2. Inventário de rotas

Baseado em `src/routes/` (37 arquivos de rota) + guards em `src/server.ts` e `src/lib/dominio-gestao.ts`. Não assumi nada pelo nome do arquivo — cada rota abaixo foi lida.

### A. Públicas e indexáveis (conteúdo real, sem bloqueio)

| URL | Arquivo | No sitemap? |
|---|---|---|
| `/` | [`index.tsx`](../src/routes/index.tsx) | Sim |
| `/sobre` | [`sobre.tsx`](../src/routes/sobre.tsx) | Sim |
| `/ajuda` | [`ajuda.tsx`](../src/routes/ajuda.tsx) | Sim |
| `/blog` | [`blog.index.tsx`](../src/routes/blog.index.tsx) | Sim |
| `/blog/$slug` (por post) | [`blog.$slug.tsx`](../src/routes/blog.$slug.tsx) | Sim, dinamicamente, só post com `publicado=true` |
| `/quiz` | [`quiz.index.tsx`](../src/routes/quiz.index.tsx) | Sim |
| `/manual` | [`manual.tsx`](../src/routes/manual.tsx) | Sim |
| `/lista-de-espera` | [`lista-de-espera.tsx`](../src/routes/lista-de-espera.tsx) | Sim |
| `/termos` | [`termos.tsx`](../src/routes/termos.tsx) | Sim |
| `/privacidade` | [`privacidade.tsx`](../src/routes/privacidade.tsx) | Sim |

Fonte da lista do sitemap: `CAMINHOS_ESTATICOS` em [`src/lib/sitemap.ts:16-26`](../src/lib/sitemap.ts).

### B. Públicas mas não deveriam ser indexadas

| URL | Arquivo | Bloqueio hoje |
|---|---|---|
| `/pesquisa` | [`pesquisa.tsx`](../src/routes/pesquisa.tsx) | **Nenhum.** Fora do sitemap (comentário do próprio sitemap.ts diz que é de propósito), mas sem `<meta name="robots">`. Ver achado P1 na seção 13. |
| `/compra-confirmada` | [`compra-confirmada.tsx`](../src/routes/compra-confirmada.tsx) | `robots: noindex` |
| `/descadastrar` | [`descadastrar.tsx`](../src/routes/descadastrar.tsx) | `robots: noindex, nofollow` |
| `/auth/login` | [`auth/login.tsx`](../src/routes/auth/login.tsx) | `robots: noindex, nofollow` |
| `/auth/cadastro` | [`auth/cadastro.tsx`](../src/routes/auth/cadastro.tsx) | `robots: noindex, nofollow` |
| `/auth/esqueci-senha` | [`auth/esqueci-senha.tsx`](../src/routes/auth/esqueci-senha.tsx) | `robots: noindex, nofollow` |
| `/auth/redefinir-senha` | [`auth/redefinir-senha.tsx`](../src/routes/auth/redefinir-senha.tsx) | `robots: noindex, nofollow` |
| `/auth/verificacao` | [`auth/verificacao.tsx`](../src/routes/auth/verificacao.tsx) | `robots: noindex, nofollow` |
| `/auth/link-expirado` | [`auth/link-expirado.tsx`](../src/routes/auth/link-expirado.tsx) | `robots: noindex, nofollow` |

Essas páginas `/auth/*` são acessíveis sem login (é o próprio caminho pra logar), por isso entram aqui e não na categoria C.

### C. Autenticadas / privadas

Todas sob `src/routes/_authenticated/`: `aimer`, `assinar`, `caderno`, `calendario`, `chamados.$id`, `chamados.index`, `clientes`, `configuracoes`, `financeiro`, `marca`, `mercado`, `metas`, `onboarding`, `painel`, `planejamento.completo`, `planejamento.index`, `planejamento.modulo.$n`, `planner.$slug`, `planner.index`, `plano-conteudo`, `produtos`, `projecao`, `raiox`, `upgrade`.

O guard é **client-side** (`_authenticated.tsx`) — o servidor devolve 200 com a casca mesmo sem sessão (o dado só chega via RLS autenticado). Por isso `src/server.ts:67-92` mantém uma lista `PREFIXOS_AUTENTICADOS` e força o header HTTP `X-Robots-Tag: noindex, nofollow` em qualquer resposta cujo path bata com um desses prefixos — isso é mais forte que meta tag porque funciona mesmo se o React não montar. **Boa prática, ver seção 19.**

### D. Administrativas

Nenhuma — `/admin` foi extraída para um projeto e domínio à parte (`polia-admin`, `silvianunoli.com.br`) em 27/07/2026. Qualquer request a `/admin*` em `usepolia.com.br` ou `www.usepolia.com.br` leva 301 pro domínio de gestão (`src/server.ts:169-176`). Fora do escopo desta auditoria (repo separado).

### E. API / sistema

- `/health` — health-check, texto puro, responde antes do roteamento.
- `/sitemap.xml`, `/robots.txt` — servidos direto pelo Worker, texto/XML puro.
- `/manual/baixar` — download do PDF do manual, autenticado por token (não é HTML).
- `/_serverFn/*` — server functions do TanStack Start (RPC interno, não é página).

### F. Teste / desenvolvimento

Nenhuma rota de teste ou dev encontrada em `src/routes/`.

### G. Rotas dinâmicas

- `/blog/$slug` — uma URL por post publicado.
- `/quiz/$` — catch-all que sempre redireciona pra `/quiz` (existe só pra não deixar `/quiz/resultado` ou qualquer sufixo cair em 404 — comentário no próprio arquivo explica um bug de loop de redirect já corrigido em 11/08/2026).
- Dinâmicas autenticadas (fora do escopo de indexação): `/chamados/$id`, `/planner/$slug`, `/planejamento/modulo/$n`.

Não existe rota `/contato` — o formulário de contato vive dentro de `/ajuda#contato` ([`ajuda.tsx:521`](../src/routes/ajuda.tsx)).

---

## 3. Ficha SEO por página pública indexável

### `/` (Home)
- **Tipo:** Home / landing principal. **Intenção:** converter visitante em lead de lista de espera, respondendo "esse produto resolve meu problema de não saber quanto sobra".
- **Title:** "Pólia · Descubra se o seu negócio dá lucro" — 42 caracteres. **BOM.**
- **Meta description:** "Veja quanto sobra em cada venda, quanto precisa entrar no mês e tome decisões com mais clareza, sem planilha e sem achismo. A Pólia organiza os números e as decisões do negócio em um só lugar." — **192 caracteres. ATENÇÃO:** passa do limite prático de exibição do Google (~155-160), deve truncar no snippet de busca.
- **H1:** "Descubra se o seu negócio dá lucro." (1 ocorrência). **BOM** — único, alinhado ao title.
- **H2 (13, na ordem):** "66% mistura a conta da casa com a conta do negócio." · "Você vende. Mas sabe quanto realmente sobra?" · "Um lugar onde o negócio inteiro cabe." · "Do papel em branco à rotina que roda." · "Um documento vivo, não um formulário." · "Preço, meta e rotina também são decisões de marca." · "O número abre. A marca aprofunda." · "Para quem vende. E para quem está começando." · "Feita por quem conhece o outro lado da conta." · "Começa grátis. Cresce quando o negócio pedir." · "O próximo orçamento vai chegar de qualquer jeito." · "Antes de criar sua conta, respostas diretas." Hierarquia consistente (H2 → H3 nos blocos de recurso/planos). **BOM**, mas ver nota de estrutura semântica na seção 9 (o texto final "Clareza sobre o negócio gera lucro." é um `<p>`, não H2 — parece heading visualmente e não é um).
- **Canonical:** `https://usepolia.com.br/`, absoluto, aponta pra si mesma. **BOM.**
- **Robots:** nenhuma tag própria → herda o padrão (indexável). **BOM**, é a intenção.
- **OG title/description:** presentes e distintos da meta description (mais curtos, focados em CTA). **BOM.**
- **OG image:** `https://usepolia.com.br/marketing/og-compartilhamento.jpg`, herdada do `__root.tsx`, 1200×630 (comentário no código confirma), arquivo próprio (não é mais o preview antigo do Lovable). **BOM.**
- **Schema:** `Organization` + `WebSite` (globais, via `__root.tsx`) + `FAQPage` (gerado do array `perguntas` do próprio arquivo — 6 perguntas, sem risco de dessincronia com o texto visível). **BOM.** Falta `WebPage`, mas não é obrigatório.
- **Sitemap:** presente, sem `lastmod` (estática — decisão de propósito, "data inventada é pior que ausente").
- **Links internos:** ~7 saídas por clique real (header: 4 âncoras + login + lista; footer: 5 links) + CTAs internos pra `#planos`/`/lista-de-espera` repetidos ao longo da página. **BOM** volume, mas é a única página que recebe link de "Sobre"/"Blog"/"Ajuda" do menu mobile e do footer — concentra toda a autoridade de entrada.
- **Imagens:** 1 (`sil.jpg`, foto da fundadora, `width=112 height=112`, `loading="lazy"`, `alt="Sil, fundadora da Pólia"`). Sem imagem acima da dobra (o hero visual é HTML/CSS — `ProdutoMock`, não `<img>` — então não há peso de imagem competindo pelo LCP).
- **Alt:** 1 imagem, 1 com alt informativo preenchido, 0 sem alt, 0 decorativa. **BOM.**
- **Status HTTP:** Não foi possível determinar no ambiente atual (sem acesso a produção via HTTP); pelo código, 200 direto, sem redirect.
- **Indexabilidade: INDEXÁVEL.** Sem bloqueio, canonical correta, conteúdo real.

### `/sobre`
- **Tipo:** Institucional / história da fundadora. **Intenção:** gerar confiança (E-E-A-T) e responder "quem está por trás disso".
- **Title:** "A história · Pólia" — 18 caracteres. **ATENÇÃO:** curto demais, desperdiça espaço de SERP e não usa palavra-chave nenhuma (nem "Pólia" sozinho ajuda a diferenciar nos resultados).
- **Meta description:** "Meu negócio vendia bem. Eu só não sabia quanto sobrava. A história da Pólia, aquilo em que ela acredita e pra quem ela é feita." — 127 caracteres. **BOM.**
- **H1:** "Meu negócio vendia bem. Eu só não sabia quanto sobrava." (1). **BOM.**
- **H2 (5):** "A Pólia é a ferramenta que eu não tive." · "Não faltava esforço. Faltava conseguir enxergar o negócio inteiro." · "Foi isso que virou a Pólia." · "Eu construo a Pólia usando a Pólia." · "A gente acredita em clareza, não em cobrança." mais um H2 de CTA final ("O método que faltou pra mim está virando produto."). **ATENÇÃO de hierarquia:** a seção "Missão e Visão" (linha 617) pula direto pra H3 ("Missão"/"Visão") sem H2 próprio — não quebra acessibilidade, mas é inconsistente com o resto da página.
- **Canonical:** `/sobre`, absoluta, correta.
- **Robots:** herdado (indexável). **BOM.**
- **OG title/description:** presentes, mais curtos que a meta description. **BOM.**
- **OG image:** herdada do root (genérica do site, não uma foto da Sil). **ATENÇÃO/oportunidade:** para uma página de "quem somos", uma OG image específica com a foto da fundadora tende a performar melhor no compartilhamento.
- **Schema:** nenhum específico (herda Organization/WebSite). **PROBLEMA leve:** candidata natural a `AboutPage` e/ou `Person` (Sil, fundadora) — nenhum dos dois existe hoje em lugar nenhum do site.
- **Sitemap:** presente, sem lastmod.
- **Links internos:** recebida por header mobile + footer (todas as páginas) — bem linkada. Ela mesma linka pra `/lista-de-espera` (CTA) e tem uma âncora interna pra `#manifesto`.
- **Imagens:** 3 — hero (`sobre-hero.png` com fontes WebP responsivas, `alt="" aria-hidden`, `width=2224 height=1664`, `loading="eager" fetchPriority="high"`), manifesto (`sobre-manifesto.jpg` + WebP, `alt="" aria-hidden`, `loading="lazy"`), e a foto da Sil repetida (`sil.jpg`, `alt="Sil, fundadora da Pólia"`, `64×64`, lazy).
- **Alt:** 1 imagem com alt informativo, 2 decorativas com `alt=""` + `aria-hidden` (correto — são fotos de ambientação, não carregam informação nova) . **BOM**, uso de `alt=""` deliberado e correto, não por esquecimento.
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: INDEXÁVEL.**

### `/ajuda`
- **Tipo:** Central de ajuda / FAQ + formulário de contato. **Intenção:** reduzir dúvida pré-conversão e captar contato.
- **Title:** "Ajuda · Pólia" — 13 caracteres. **ATENÇÃO:** muito curto, sem contexto do que tem na página (poderia incluir "perguntas frequentes" ou similar).
- **Meta description:** "Central de ajuda da Pólia. Respostas curtas e diretas, e um canal pra falar com a gente." — 88 caracteres. **BOM**, mas conservador — dá pra ser mais descritivo sem estourar o limite.
- **H1:** "Travou em alguma coisa? A gente explica." (1). **BOM.**
- **H2 (4):** "Respostas separadas por assunto." · "A Pólia não quer complicar o que já é complicado." · "Não encontrou? Fala com a gente." · "Comece pela pergunta mais importante." · "Não encontrou o que precisava? Escreve pra gente." (5 no total). **ATENÇÃO:** duas variações quase idênticas de "não encontrou" como heading em seções diferentes da mesma página — não é erro técnico, mas é redundância editorial.
- **Canonical:** `/ajuda`, correta.
- **Robots:** herdado (indexável).
- **OG title/description:** presentes.
- **OG image:** herdada (genérica).
- **Schema:** **PROBLEMA:** o conteúdo é literalmente um FAQ (6 categorias × 3 perguntas = 18 perguntas e respostas visíveis) e não tem `FAQPage` estruturado — só a Home usa `jsonLdFaq`. É a maior lacuna isolada de dados estruturados do site.
- **Sitemap:** presente.
- **Links internos:** recebida do footer/header em todas as páginas. Ela mesma não linka pra outras páginas de conteúdo (só CTA pra `/lista-de-espera`).
- **Imagens:** 0.
- **Alt:** N/A (nenhuma imagem).
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: INDEXÁVEL.**

### `/blog` (listagem)
- **Tipo:** Listagem de blog. **Intenção:** hub de conteúdo, capturar busca de cauda longa.
- **Title:** "Blog da Pólia · Pra quem toca a marca" — 37 caracteres. **BOM.**
- **Meta description:** "Textos pra quem toca o próprio negócio decidir com mais clareza: preço, desconto, compra, venda e o que sobra no fim do mês." — 124 caracteres. **BOM.**
- **H1:** "Pra quem toca a marca." (1). **BOM.**
- **H2:** dinâmico — o post em destaque usa o próprio título como H2, mais "Mais textos" como rótulo de seção (é `Eyebrow`, ou seja um `<p>`, não heading) e "Ver quanto sobra em cada venda leva menos tempo que ler um texto." como H2 de captura no fim. **Hoje, com 0 posts publicados, a página renderiza o estado vazio** ("O blog está sendo escrito. Ainda não tem texto publicado.") sem H2 nenhum de post.
- **Canonical:** `/blog`, correta.
- **Robots:** herdado (indexável).
- **OG title/description:** presentes.
- **OG image:** herdada (genérica).
- **Schema:** nenhum (nem `Blog`/`CollectionPage` estruturado).
- **Sitemap:** presente.
- **Links internos:** cada post (quando existir) linka pro próprio `/blog/$slug`; hoje, zero links de saída pra artigo, porque não há artigo.
- **Imagens:** 0 hoje (sem posts, os cards com capa não renderizam). Quando houver post, o card sem `capa_url` cai numa cor sólida de fundo (rotação turquesa/pêssego/rosa) — sem imagem real.
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: PROBLEMA / PRECISA INVESTIGAR.** Tecnicamente indexável e sem bloqueio, mas **o conteúdo real hoje é zero** — é uma página "thin content" enquanto os 7 rascunhos não forem publicados (ver seção 7 e achado P2).

### `/blog/$slug` (template de artigo)
- **Tipo:** Artigo de blog. **Intenção:** capturar busca de cauda longa e demonstrar autoridade/E-E-A-T.
- **Title:** `${titulo do post} · Blog · Pólia` (dinâmico) ou fallback "Blog da Pólia · Pra quem toca a marca" se o loader falhar. O sufixo consome 16 caracteres — títulos de post acima de ~44 caracteres passam de 60 no total. **Não determinável hoje** (zero posts publicados pra medir na prática); ficha de processo para quando publicar.
- **Meta description:** `resumo` do post ou fallback "Texto de quem toca o próprio negócio sobre as decisões que dá pra tomar com mais clareza." — depende do CMS, não determinável no ambiente atual.
- **H1:** título do post (1 por página, controlado pelo template). **BOM** como estrutura.
- **H2/H3:** vem do corpo em Markdown, renderizado via `dangerouslySetInnerHTML` (`renderBlogMarkdown`) — a hierarquia real depende do que a autora escreve em cada post; o CSS (`PROSA` em `blog.$slug.tsx:35-51`) já estiliza `h2`/`h3` corretamente, então tecnicamente suportado, mas o conteúdo em si **não foi possível determinar no ambiente atual** (0 posts publicados).
- **Canonical:** `/blog/${slug}`, construída a partir do param da rota, sempre correta e sem duplicação possível (um slug = uma URL).
- **Robots:** herdado (indexável) — inclusive para posts despublicados, que não geram rota (loader lança `notFound()` se `publicado != true`, então um rascunho nunca fica acessível por URL).
- **OG title/description:** título/resumo do post.
- **OG image:** `capa_url` do post **se existir**; senão, **não seta og:image nenhum** (o array de meta só inclui a linha condicionalmente) e o post herda a imagem genérica do `__root.tsx`. **ATENÇÃO:** nenhum dos 7 rascunhos atuais tem `capa_url` preenchida — se forem publicados como estão, todos vão compartilhar a mesma imagem genérica no card social.
- **Schema:** **PROBLEMA confirmado.** Nenhum `Article`/`BlogPosting`, nenhum `author` (`Person`), nenhum `datePublished`/`dateModified`, nenhum `BreadcrumbList`. A data de publicação e "Por Sil" só existem como texto visível, não como dado estruturado.
- **Sitemap:** por post, com `lastmod` = `publicado_em` formatado (`YYYY-MM-DD`) — **BOM**, um dos poucos lugares do site com lastmod real.
- **Links internos:** "Voltar pro blog" (`/blog`), até 3 posts relacionados (mesma listagem, exclui o post atual, ordenado por mais recente — não por relevância de categoria), CTA pra `/lista-de-espera`. Sem link para `/sobre` ou `/ajuda` a partir do corpo do artigo (só via header/footer globais).
- **Imagens:** capa (se existir) sem `width`/`height` explícitos (usa `aspect-[16/7]` via CSS, o que evita CLS mesmo sem os atributos), `alt=""` sempre (decorativa) mesmo quando é a imagem de capa do post — **defensável** (o título já está ao lado como texto), mas é uma oportunidade perdida de SEO de imagem (Google Imagens) se a capa for editorial/ilustrativa.
- **Status HTTP:** slug inexistente ou despublicado → `notFoundComponent` próprio (precisa confirmar se retorna HTTP 404 real ou 200 com "página não encontrada" — **não foi possível determinar no ambiente atual**, mas o padrão do TanStack Start com `notFound()` lançado no loader tende a gerar 404 real).
- **Indexabilidade: PROVAVELMENTE INDEXÁVEL** (por post, quando publicado) — sem posts publicados hoje, esta linha está vazia na prática.

### `/quiz`
- **Tipo:** Isca/lead magnet interativo (quiz "Você está pagando pra trabalhar?"). **Intenção:** captura de e-mail via diagnóstico, tráfego vindo da bio do Instagram (@hub.polia).
- **Title:** "Você está pagando pra trabalhar? · Pólia" — 40 caracteres. **BOM.**
- **Meta description:** "8 perguntas, 2 minutos, sem julgamento. Descubra onde as decisões de dinheiro do seu negócio ainda saem no chute." — 113 caracteres. **BOM.**
- **H1:** presente (linha 111), texto de abertura do quiz. **BOM**, 1 ocorrência.
- **H2:** 3 encontrados no arquivo (linhas 176, 272, 387), ligados aos estados de fluxo (pergunta/gate de e-mail/resultado) — como é um funil de estado único (React state, sem mudar de URL), só um H2 fica visível por vez; estrutura correta para quem chega direto na URL.
- **Canonical:** `/quiz`, correta — inclusive o catch-all `/quiz/$` sempre redireciona de volta pra cá, então não há como uma URL de estado interno (`/quiz/resultado` etc.) escapar e criar conteúdo duplicado.
- **Robots:** herdado (indexável).
- **OG title/description:** presentes, ligeiramente diferentes do title/description (mais curtos).
- **OG image:** herdada (genérica) — nenhuma OG image específica pro quiz.
- **Schema:** nenhum. Um `Quiz` estruturado não existe no vocabulário padrão do schema.org, então não é lacuna real.
- **Sitemap:** presente.
- **Links internos: PROBLEMA.** Zero páginas do site linkam pra `/quiz` — nem header, nem footer, nem home, nem blog. Só existe no sitemap e no link da bio do Instagram (fora do site). Órfã por design (funil fechado), mas órfã mesmo assim.
- **Imagens:** 0 (usa `PoliaWordmark`, SVG).
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: INDEXÁVEL**, mas com autoridade interna zero.

### `/manual`
- **Tipo:** Landing de isca gratuita ("O Manual da Pequena Marca que Quer Ser Grande"). **Intenção:** captura de e-mail em troca de PDF.
- **Title:** "O Manual da Pequena Marca que Quer Ser Grande · Pólia" — 53 caracteres. **BOM**, no limite superior confortável.
- **Meta description:** "Guia gratuito em 17 seções, com exercícios e um plano de 7 dias, pra quem toca a própria marca e quer que ela pareça do tamanho do negócio. O PDF chega na hora, depois do e-mail." — **178 caracteres. ATENÇÃO:** passa do limite prático, deve truncar.
- **H1:** "Sua empresa pode ser pequena. Sua marca não precisa parecer." (1, linha 507). **BOM.**
- **H2 (5+):** "Marca grande não espera a empresa crescer." e mais 4 headings de seção (linhas 585, 640, 674 e o H2 do formulário de captura, que também existe como H2 próprio dentro do cartão de pedido — ver nota abaixo). Hierarquia correta na ordem do DOM (H1 primeiro, depois os H2 do formulário lateral e das seções seguintes).
- **Canonical:** `/manual`, correta.
- **Robots:** herdado (indexável).
- **OG title/description:** presentes e diferentes da meta description (o og:title é a manchete real da página, não o nome do material).
- **OG image:** herdada (genérica) — sem capa própria pro material.
- **Schema:** nenhum (candidato a `Product`/`CreativeWork` pro material gratuito, mas não obrigatório).
- **Sitemap:** presente.
- **Links internos: PROBLEMA**, mesmo caso do `/quiz` — zero páginas do site linkam pra cá. Órfã por design.
- **Imagens:** 0 (ícones lucide, sem foto).
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: INDEXÁVEL**, autoridade interna zero.

### `/lista-de-espera`
- **Tipo:** Squeeze page de pré-lançamento. **Intenção:** captura de e-mail pra fila de espera (destino de quase todo CTA "Entrar na lista" do site, por decisão de pré-lançamento).
- **Title:** "Entrar na lista · Pólia" — 23 caracteres. **ATENÇÃO:** curto e genérico — não comunica o produto pra quem chega direto de busca (embora essa página normalmente receba tráfego interno/CTA, não busca orgânica).
- **Meta description:** "A Pólia mostra se o seu negócio dá lucro e quanto sobra em cada venda. Será lançada em outubro: entre na lista pra ser uma das primeiras a usar." — 144 caracteres. **BOM.**
- **H1:** presente (linha 224). **BOM.**
- **H2:** múltiplos (391, 410, 482, 517, 548, 585, 613), estrutura de página longa tipo landing — todos depois do H1, sem inversão.
- **Canonical:** `/lista-de-espera`, correta.
- **Robots:** herdado (indexável). Coerente: é uma squeeze page de propósito, mas o conteúdo dela (o que é a Pólia, quando lança) tem valor de busca próprio.
- **OG title/description:** presentes.
- **OG image:** herdada (genérica).
- **Schema:** nenhum específico.
- **Sitemap:** presente.
- **Links internos:** é o destino de quase todo CTA do site (header, home, sobre, ajuda, blog) — a página **mais linkada internamente** depois da Home. Ela mesma não usa `SiteHeader` completo (usa a variante com `semLogin`, é rota "sem saída" de propósito — squeeze page).
- **Imagens:** 0.
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: INDEXÁVEL.**

### `/termos`
- **Tipo:** Institucional/legal. **Intenção:** compliance, não conversão.
- **Title:** "Termos de uso · Pólia" — 21 caracteres. **BOM** pro tipo de página.
- **Meta description:** "Termos de uso da Pólia. Em linguagem clara, sem letra miúda escondendo pegadinha." — 81 caracteres. **BOM.**
- **H1:** 1, presente (linha 62).
- **H2 (12):** numerados e âncorados (`#aceitacao` a `#contato`), hierarquia impecável. **BOM**, referência de estrutura pro resto do site.
- **Canonical:** `/termos`, correta.
- **Robots:** herdado (indexável) — correto, é conteúdo público de baixo risco.
- **OG:** não definido explicitamente (herda root); aceitável pra página legal.
- **Schema:** nenhum (`TermsOfService` não é um tipo padrão relevante do schema.org — não é lacuna).
- **Sitemap:** presente.
- **Links internos:** recebida do footer em toda página.
- **Imagens:** 0.
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: INDEXÁVEL.**

### `/privacidade`
- **Tipo:** Institucional/legal (LGPD). **Intenção:** compliance.
- **Title:** "Privacidade · Pólia" — 19 caracteres. **BOM.**
- **Meta description:** "Política de Privacidade da Pólia, no padrão LGPD. Os dados são da titular. Nós explicamos o que coletamos, por quê e como ela controla." — 135 caracteres. **BOM.**
- **H1:** 1 (linha 85).
- **H2 (12):** numerados e âncorados, mesmo padrão de `/termos`. **BOM.**
- **Canonical:** `/privacidade`, correta.
- **Robots:** herdado (indexável).
- **Schema:** nenhum.
- **Sitemap:** presente.
- **Links internos:** footer, todas as páginas.
- **Imagens:** 0.
- **Status HTTP:** Não foi possível determinar no ambiente atual.
- **Indexabilidade: INDEXÁVEL.**

### `/pesquisa` (fora do sitemap, sem robots — caso à parte)
- **Tipo:** Formulário de pesquisa aberta. **Intenção:** coleta de dados de mercado, não é conteúdo de busca.
- **Title:** "Uma pergunta rápida sobre o seu negócio · Pólia" — 47 caracteres.
- **Meta description:** "Me conta como está o seu negócio hoje: uma pesquisa rápida e anônima sobre preço, lucro e o que mais aperta." — 108 caracteres.
- **Canonical:** definida (`/pesquisa`) — o que é estranho justamente por não ter `robots`: a página declara canonical (sinal de "sou uma página de verdade") mas não declara `noindex` (sinal de "não me indexe").
- **Robots: PROBLEMA.** Nenhuma tag `robots` no `head()`. Diferente de `/compra-confirmada` e `/descadastrar`, que são igualmente "não-conteúdo" e têm `noindex` explícito.
- **Sitemap:** ausente — mas por omissão na lista estática, não por bloqueio ativo.
- **Links internos:** não encontrei nenhum link para `/pesquisa` a partir de header, footer, home, sobre, ajuda ou blog — parece também ser uma isca/rota "só por link direto".
- **Indexabilidade: PROBLEMA / PRECISA INVESTIGAR.** Sem link interno e fora do sitemap ela tem baixa chance de ser rastreada, mas não é impossível (link externo, compartilhamento, ferramenta de terceiro) — e se for rastreada, hoje **entra no índice**, porque nada impede.

---

## 4. SEO técnico global

### Robots.txt
Existe, servido por `src/server.ts` a partir de [`src/lib/robots.ts`](../src/lib/robots.ts). Conteúdo: é uma cópia literal do robots.txt gerenciado pela Cloudflare (capturada em 17/08/2026), com `Allow: /` geral e bloqueio (`Disallow: /`) só para 9 crawlers de treino de IA nomeados (Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, CloudflareBrowserRenderingCrawler, Google-Extended, GPTBot, meta-externalagent) — não bloqueia buscadores. Uma linha `Sitemap: https://usepolia.com.br/sitemap.xml` foi adicionada manualmente, porque o robots.txt gerenciado da Cloudflare não inclui isso. **Risco documentado no próprio código:** se a Cloudflare atualizar o robots.txt gerenciado no edge depois de um deploy, ela pode sobrescrever esse arquivo — o comentário do código já avisa que a correção nesse caso precisa ser feita no painel da Cloudflare, não aqui. **Nenhum bloqueio perigoso encontrado** (não bloqueia CSS/JS, não bloqueia páginas públicas).

### Sitemap.xml
Existe, gerado dinamicamente em `respostaSitemap()` (`src/server.ts:26-50`), servido com `cache-control: public, max-age=3600`. Contém as 9 URLs estáticas de `CAMINHOS_ESTATICOS` (sem lastmod) + uma entrada por post com `publicado=true` (com `lastmod`). Hoje, **0 entradas de post** (nenhum publicado). Falha ao buscar posts do Supabase não derruba o sitemap inteiro — cai pra só as estáticas (decisão de propósito, documentada no código: "sitemap que responde erro o Google descarta inteiro"). **Ausências corretas de propósito:** `/pesquisa`, `/compra-confirmada`, `/descadastrar`, `/auth/*` — mas ver P1 do `/pesquisa` acima, porque a ausência no sitemap não substitui um bloqueio de indexação.

### Canonicalização
- **HTTP vs HTTPS:** força HTTPS no redirect de host (`url.protocol = "https:"` em `src/server.ts:187`).
- **www vs non-www:** `www.usepolia.com.br` está nas `routes` do Worker (wrangler.jsonc) mas **não** é host oficial (`HOSTS_OFICIAIS` só tem o apex + domínio de gestão) → 301 automático pro apex. **BOM.**
- **`*.workers.dev`:** mantido ligado de propósito como fallback operacional, mas também recebe 301 pro domínio próprio — o comentário no código é explícito sobre o motivo (evitar índice duplicado).
- **Trailing slash / parâmetros:** não vi normalização explícita de trailing slash, mas o roteador (TanStack Router) não parece gerar variantes com/sem barra como URLs distintas pros arquivos de rota lidos. Não foi possível determinar no ambiente atual se `/blog/` (com barra) e `/blog` coexistem como respostas 200 diferentes sem redirect.
- **Rotas equivalentes:** nenhuma encontrada (sem parâmetro de tracking mudando o conteúdo da página de forma que crie URL indexável duplicada — filtro de categoria do blog é só estado local do React, não vira query string).
- **Canonical incorreto:** nenhum encontrado — todas as páginas líidas usam `linkCanonico(caminho)` com o próprio caminho literal da rota.

### Redirects
- 301: host não-oficial → domínio canônico (`src/server.ts:186-191`); `/admin*` em domínio de produto → domínio de gestão (`src/server.ts:169-176`).
- 307 (implícito, via `redirect()` do TanStack Router): `/quiz/$` (qualquer coisa depois de `/quiz/`) → `/quiz`; `/auth/cadastro` → `/lista-de-espera` no client quando não há sessão nem `?email=` (pré-lançamento).
- Nenhuma cadeia de redirect (A→B→C) nem loop encontrados. O próprio código documenta um loop de 307 que existiu em 11/08/2026 e foi corrigido movendo a página de `quiz.tsx` pra `quiz.index.tsx`.

### Indexação
- Nenhum `noindex` acidental encontrado nas páginas de conteúdo.
- Nenhuma página de teste exposta.
- Conteúdo vazio indexável: **sim, `/blog`** (ver seção 7).
- Parâmetro indexável: não encontrado (buscas internas, como a de `/ajuda`, não mudam a URL).
- Página privada indexável: não — o `X-Robots-Tag` no header HTTP cobre isso mesmo se o React falhar em montar.

### JavaScript / SSR
Confirmado: **é SSR de verdade**, não é SPA client-only. `src/server.ts` importa `@tanstack/react-start/server-entry` e processa a request no Worker. O loader de `/blog` busca os posts direto do Supabase **no servidor**, e o comentário no próprio código explica exatamente a preocupação da auditoria: *"a busca mora no loader (e não num useEffect) pra que o HTML servido já saia com os links dos posts: sem isso o Google recebia uma listagem vazia e nunca chegava em `/blog/$slug`."* Mesmo padrão em `/blog/$slug` (post + relacionados) e em `/pesquisa` (pergunta ativa). **Isso é uma prática correta e deliberada** — o risco real hoje não é técnico, é de conteúdo (zero posts).

---

## 5. Estrutura semântica (heading, HTML)

- **H1 duplicado:** nenhum encontrado — cada página lida tem exatamente 1 H1.
- **Páginas sem H1:** nenhuma encontrada entre as públicas indexáveis.
- **H1 genérico demais:** nenhum — todos são frases completas e específicas.
- **H2 fora de ordem:** um caso, `/sobre`, seção "Missão e Visão" pula de H2 pra H3 sem H2 próprio (ver ficha de `/sobre`).
- **Heading usado só por estilo:** o componente `Eyebrow` (rótulo de seção em caixa alta, ex.: "O problema", "Planos") é `<p>`, não heading — correto, não é abusado como H-tag.
- **Texto que parece heading mas é `<p>`:** a frase de fechamento "Clareza sobre o negócio gera lucro." aparece como `<p>` em pelo menos 2 páginas (Home e `/sobre`) com estilo visual de heading grande — inofensivo para SEO (não afeta indexação), mas é uma inconsistência de marcação que vale mencionar pra quem for revisar acessibilidade.
- **Conteúdo importante escondido em componente client-only:** não encontrado — as páginas públicas são todas SSR e o conteúdo textual está no JSX, não atrás de fetch client-only (a única dependência de rede é o loader de `/blog`, `/blog/$slug` e `/pesquisa`, que roda no servidor).
- **Links que não são links HTML reais:** os CTAs usam `<a href>` ou `<Link>` do TanStack Router consistentemente — não encontrei `<div onClick>` fazendo o papel de link em navegação de página.
- **Botões usados quando deveria ser link:** o filtro de categoria do blog e o "ver todos" usam `<button>` corretamente (não mudam de URL/página, é filtro de estado) — uso correto, não é um problema.

---

## 6. Links internos (mapa)

```
HOME (mais linkada, recebe de: footer/header de TODAS as páginas)
├── SOBRE (footer + menu mobile, em todas as páginas)
├── BLOG (footer, em todas as páginas)
│   └── /blog/$slug (só entre si — relacionados; 0 posts hoje)
├── AJUDA (footer, em todas as páginas)
├── TERMOS (footer, em todas as páginas)
├── PRIVACIDADE (footer, em todas as páginas)
├── LISTA DE ESPERA (header "Entrar na lista" + dezenas de CTA em Home/Sobre/Ajuda/Blog — página mais linkada depois da Home)
├── AUTH/LOGIN (header "Entrar", em todas as páginas)
│
├── QUIZ  ⚠ órfã — 0 links internos, só sitemap + link externo (bio do Instagram)
├── MANUAL ⚠ órfã — 0 links internos, só sitemap + link externo (bio do Instagram)
└── PESQUISA ⚠ órfã — 0 links internos, fora do sitemap também
```

- **Páginas com mais links internos apontando pra elas:** Home, depois Lista de espera, depois Sobre/Blog/Ajuda/Termos/Privacidade (empatadas via footer).
- **Páginas importantes isoladas:** `/quiz`, `/manual`, `/pesquisa` — sem nenhum link interno. Pra `/quiz` e `/manual` isso é coerente com o papel delas (funil fechado, tráfego só de bio) — mas do ponto de vista de arquitetura de informação, zero autoridade interna flui pra essas páginas, e se um dia quiserem ranquear por busca orgânica (não só capturar quem já veio do Instagram), vão precisar de pelo menos um link discreto (ex.: um card no footer ou numa seção do blog).
- **Links quebrados:** nenhum encontrado nas rotas estáticas (todos os `Link to=` e `href=` internos lidos apontam pra rotas existentes). Links de post-a-post (`/blog/$slug`) dependem de dado dinâmico e não puderam ser testados (0 posts).
- **Âncoras genéricas:** poucas — a maioria dos CTAs usa texto específico ("Quero descobrir se dá lucro", "Entrar na lista"), não "clique aqui"/"saiba mais" genérico. **BOM.**
- **Link externo que sai do domínio:** rodapé, "Desenvolvido por Hub Pólia Soluções Digitais" → `https://servicos.usepolia.com.br/`, sem `rel="nofollow"` nem `sponsored` — é um link institucional pra outro produto da própria Sil, não é grave, mas tecnicamente passa equity pra fora do domínio principal em toda página do site.
- **Oportunidade de contextual linking:** nenhum artigo de blog linka pra `/manual` ou `/quiz` (nem poderia, ainda não há artigo) — quando publicar os 7 rascunhos, cada um é uma chance natural de linkar pra essas duas iscas por contexto (ex.: um post sobre precificação linkando pro quiz "Você está pagando pra trabalhar?").

---

## 7. Auditoria do blog

### `/blog`
Já coberto na ficha da seção 3. Resumo: SSR real via loader, mas **0 posts publicados agora**.

### `/blog/$slug`
Já coberto na ficha da seção 3. Resumo dos achados de schema/E-E-A-T: sem `Article`/`BlogPosting`, sem `author` estruturado, sem `datePublished`/`dateModified` estruturado, sem `BreadcrumbList`.

### Estado real do conteúdo (consulta `SELECT` na tabela `blog_posts`, produção, 15/09/2026)

| Métrica | Valor |
|---|---|
| Posts publicados | **0** |
| Rascunhos | 7 |
| Slugs distintos | 7 (sem duplicidade) |
| Rascunhos sem resumo | 0 |
| Rascunhos sem capa | **7 de 7** |
| Rascunhos sem categoria | 0 |
| Rascunhos com conteúdo < 800 caracteres | 0 |

Os 7 rascunhos, por categoria: **Validação de ideia** (2: "Como saber se uma ideia de negócio tem potencial", "O que fazer com uma ideia que ainda não tenho certeza se funciona"), **Gestão financeira** (2: "Minha empresa vende, mas não sai do lugar", "Faturamento não é o mesmo que dinheiro que sobra"), **Precificação** (1: "Como definir o preço de um produto sem copiar a concorrência"), **Organização** (2: "Como se organizar quando você é a empresa inteira", "Como saber o que merece atenção primeiro"). Tamanho de conteúdo entre 1974 e 3362 caracteres (~300-550 palavras) — curto pra padrão de SEO de formato longo, mas coerente com o tom "resposta direta" da marca.

- **Artigos sem resumo:** nenhum dos 7.
- **Artigos sem imagem:** **todos os 7** — quando publicados, cada um vai cair no bloco de cor sólida (rotação turquesa/pêssego/rosa) em vez de imagem própria, e nenhum vai ter `og:image` específico.
- **Artigos muito curtos:** nenhum abaixo de 800 caracteres, mas todos na faixa "curta" (abaixo de ~600 palavras).
- **Artigos duplicados:** nenhum (slugs e títulos distintos).
- **Categorias sem conteúdo:** não se aplica — não existe rota de categoria (`/blog/categoria/x`), o filtro é só client-side.
- **Categoria indexável sem valor:** não se aplica, pelo mesmo motivo (nenhuma URL de categoria existe).
- **Conteúdo órfão:** não se aplica ainda (0 publicado).
- **Canibalização:** risco baixo mesmo com 4 categorias e 7 posts — os títulos não se sobrepõem em intenção (cada um responde uma pergunta diferente). Ver seção 17 para o caso específico Home vs. futuros posts de precificação.

---

## 8. E-E-A-T / autoria

- **Quem é a Pólia:** clara — `/sobre` conta a história, a home tem seção "Quem fez", o footer mostra CNPJ (`18.305.925/0001-06`) e cidade/país ("feita no Brasil").
- **Quem é Sil:** clara e consistente — `/sobre` é inteiramente sobre ela (14 anos de e-commerce, 8 de negócio próprio, passagens por C&A/Allied/ArcelorMittal citadas), foto real (`sil.jpg`) usada 2x (Home e Sobre).
- **Quem escreve os conteúdos:** "Por Sil" aparece em todo card e página de post (visualmente), mas **não em dado estruturado** — não há `author` no JSON-LD nem um schema `Person` reaproveitável entre páginas.
- **Experiência relevante da autora:** presente em texto (`/sobre`), mas não capturada em schema (`Person.hasCredential`/`worksFor`/etc. não existem).
- **Informações institucionais:** CNPJ no footer (todas as páginas), e-mail de contato (`oi@usepolia.com.br`) em `/ajuda`.
- **Formas de contato:** formulário em `/ajuda#contato` com Turnstile anti-bot e honeypot, mais e-mail direto, mais SLA de resposta declarado ("até 24 horas úteis"). **BOM**, é mais do que a maioria dos concorrentes desse porte costuma expor.
- **Sinais de confiança:** política de privacidade e termos completos e numerados, CNPJ visível, sem alegação não sustentável (a home evita "depoimento reservado" até existir usuária real — decisão documentada no próprio código).
- **O que falta:** nenhum schema `Person`/`AboutPage` amarrando Sil↔Pólia formalmente pros buscadores; nenhuma página ou seção "imprensa"/"prêmios"/"credenciais externas" (não é obrigatório, só não existe).

---

## 9. Dados estruturados (mapa completo)

| Página | Tipo | Onde | Observação |
|---|---|---|---|
| Todas (via `__root.tsx`) | `Organization` | `src/lib/jsonld.ts:36` | `name`, `url`, `logo`. Sem `sameAs` (redes sociais) de propósito — comentário no código diz "sem dado inventado". |
| Todas (via `__root.tsx`) | `WebSite` | `src/lib/jsonld.ts:46` | `name`, `url`, `inLanguage: pt-BR`. Sem `SearchAction` (site não tem busca indexável por URL). |
| `/` | `FAQPage` | `src/routes/index.tsx:42` | Gerado a partir do array `perguntas` visível na página — **não pode dessincronizar** (boa prática). |
| `/ajuda` | — | — | **Ausente.** Maior lacuna: 18 perguntas visíveis, zero `FAQPage`. |
| `/blog/$slug` | — | — | **Ausente.** Nenhum `Article`/`BlogPosting`. |
| `/sobre` | — | — | **Ausente.** Candidata a `AboutPage`/`Person`. |
| Qualquer | `BreadcrumbList` | — | **Ausente em todo o site.** Não há trilha de navegação estruturada em lugar nenhum (nem visual, nem em schema). |

Nenhuma duplicação ou schema conflitante encontrado — o problema aqui é ausência, não erro.

---

## 10. Core Web Vitals / performance

**Dado medido:** Não foi possível determinar no ambiente atual (sem Lighthouse/PageSpeed Insights disponível nesta sessão).

**Risco identificado no código** (LCP):
- Home: elemento provável de LCP é o H1 + parágrafo do hero (texto) ou o mock do produto — `ProdutoMock` é HTML/CSS puro (606 linhas, sem `<img>`), então **não há imagem competindo pelo LCP** na Home. Ponto positivo.
- `/sobre`: a foto de hero (`sobre-hero.png`/webp) é candidata a LCP e já está corretamente marcada `loading="eager"` + `fetchPriority="high"`, com `width`/`height` explícitos (evita CLS) e fontes WebP responsivas por `<picture>`. **Bem feito.**
- Fontes: Google Fonts (Fraunces, Inter, DM Sans) e Fontshare (Cabinet Grotesk) carregadas via `<link rel="stylesheet">` no `<head>` do root, ambas com `&display=swap` — mitiga FOIT (texto invisível), mas ainda são 2 domínios externos adicionais no caminho crítico (`fonts.googleapis.com`/`fonts.gstatic.com` com `preconnect`, mas **`api.fontshare.com` sem `preconnect`**). **Risco identificado:** a fonte de título (Cabinet Grotesk) pode chegar depois das outras por não ter preconnect, causando um pequeno reflow/troca de fonte visível nos títulos.

**Risco identificado no código** (CLS):
- Imagens estáticas (`/sobre`) têm `width`/`height` explícitos. **Bom.**
- Capas de blog (`blog.index.tsx`, `blog.$slug.tsx`) **não têm `width`/`height`**, mas usam `aspect-video`/`aspect-[16/7]` via Tailwind, que reserva o espaço do mesmo jeito — risco de CLS baixo mesmo sem os atributos nativos.
- Banner de cookie (`CookieConsent`) e CTA flutuante da Home (aparece só depois de rolar 90% da viewport) — ambos aparecem depois do carregamento inicial; **não determinável no ambiente atual** se causam CLS mensurável (dependem de posição `fixed`, que normalmente não desloca o layout abaixo, mas não foi possível confirmar sem medir).

**Risco identificado no código** (INP/JS inicial):
- Home usa `framer-motion` para a faixa de ferramentas animada e transições de entrada (`Reveal`/`RevealGroup`) em quase todo bloco — biblioteca de animação com custo de JS não-trivial, mas já respeita `prefers-reduced-motion` na faixa de ferramentas (`useReducedMotion`). **Não determinável no ambiente atual** o peso real do bundle carregado antes de interatividade.
- GA4 só carrega depois de consentimento de cookie E via `useEffect` (nunca bloqueia o carregamento inicial, nunca roda no domínio de gestão). **Boa prática, ver seção 19.**

---

## 11. SEO + posicionamento da Pólia

Confrontando contra `polia-app/CLAUDE.md` (regra de vocabulário, eixo "número primeiro, marca depois" e proibições de 15/09/2026):

- A copy pública auditada (Home, Sobre, Ajuda, Blog, Manual, Lista de espera) **não usa nenhum termo da lista proibida** ("fatura mais", "no seu ritmo", "planilha por fora", "infoproduto", "turma", "etapa"/"trilha"/"jornada" como vocabulário de produto, nomes de plano mortos) nas partes lidas.
- O eixo "número primeiro, marca depois" está presente e é literalmente estrutural na Home (seção "O diferencial": "O número abre. A marca aprofunda.") e ecoado em `/sobre`. **Consistente.**
- Nomes de planos (Grátis/Premium/Pro) batem com o texto oficial vigente desde 14/09/2026.
- **Uma intenção por página**, avaliação:
  - `/` — mistura conversão (planos, CTA) + prova social + institucional ("quem fez") numa página só, mas isso é esperado de uma home de produto — não é "confusão", é a estrutura padrão do formato.
  - `/sobre` — intenção clara (confiança/história).
  - `/ajuda` — intenção clara (suporte), mas tem também um bloco de conversão ("Ainda não tem conta?") que poderia ser visto como intenção secundária — aceitável, é comum em central de ajuda pré-venda.
  - `/quiz`, `/manual` — cada um com intenção única (captura de lead por formato de isca diferente).
  - `/pesquisa` — intenção única (pesquisa de mercado), mas por não ter link interno nem bloqueio de indexação claro, fica ambígua sobre se é "conteúdo do site" ou "ferramenta interna" (ver P1 na seção 13).

---

## 12. Oportunidades de palavras-chave (sem volume de busca — não há ferramenta disponível)

| Página | Intenção/palavra principal | Intenções secundárias | Risco de canibalização | Oportunidade |
|---|---|---|---|---|
| `/` | "quanto sobra no negócio" / "meu negócio dá lucro" | preço, gestão financeira pequena empresa | Baixo hoje; **alto no futuro** com posts de "Gestão financeira" e "Faturamento não é o mesmo que dinheiro que sobra" — ambos competem pela mesma intenção da Home. Ver seção 17. | Home já domina a intenção "quanto sobra"; posts deveriam ir mais fundo/específico (ex.: um cálculo, um caso), não repetir a promessa geral. |
| `/sobre` | "quem é a Pólia" / branded | — | Nenhum | Schema `Person`/`AboutPage` reforçaria E-E-A-T pra buscas com o nome da Sil. |
| `/blog` | hub de conteúdo, sem palavra-chave própria | — | Nenhum | Só ganha relevância quando os posts forem publicados. |
| Post "Como definir o preço de um produto sem copiar a concorrência" | "como precificar produto" | precificação, concorrência | Médio — sobrepõe parcialmente a seção "Preço" da Home ("Quanto sobra de verdade?") | Boa oportunidade de cauda longa se aprofundar além do que a Home já cobre em 2 frases. |
| Post "Minha empresa vende, mas não sai do lugar" / "Faturamento não é o mesmo que dinheiro que sobra" | "faturamento x lucro" | gestão financeira, fluxo de caixa | **Alto** — a frase de assinatura do site inteiro é "Clareza sobre o negócio gera lucro." e a Home já responde exatamente "faturar não é lucrar". Ver P2 seção 17. | Se os posts citarem e linkarem a calculadora da Home/produto em vez de repetir o argumento, reforçam em vez de competir. |
| Posts de "Validação de ideia" | "como validar ideia de negócio" | pré-venda, planejamento | Baixo (Home não fala de pré-venda/ideação) | Território novo, sem sobreposição — bom uso do blog pra alcançar uma intenção que a Home não cobre. |
| Posts de "Organização" | "como se organizar sendo a empresa inteira" | rotina, produtividade solo | Baixo | idem — território novo. |
| `/quiz`, `/manual` | branded / captura direta de bio | — | Nenhum (não competem por busca, vivem de tráfego direto) | — |

---

## 13. Problemas de SEO (consolidado)

**[P1]**
Problema: `/pesquisa` não tem nenhuma tag `robots` e está fora do sitemap só por omissão, não por bloqueio ativo.
Página: `/pesquisa`
Evidência: [`src/routes/pesquisa.tsx:17-31`](../src/routes/pesquisa.tsx) (só `title`/`description`/`canonical`, sem `robots`) vs. `/compra-confirmada` e `/descadastrar`, que têm `noindex` explícito para o mesmo tipo de página não-editorial.
Impacto: se a URL for descoberta por qualquer via externa (link, compartilhamento, crawler agressivo), ela é indexável, e é um formulário sem valor de busca — polui o índice e pode aparecer em resultado de marca junto com páginas de conteúdo de verdade.
Recomendação: decidir a intenção real (é uma isca editorial, como `/quiz`/`/manual`, ou é uma ferramenta interna de pesquisa?) e alinhar sitemap + `robots` na mesma direção.

**[P1]**
Problema: `/blog` está indexável, no sitemap, com zero posts publicados.
Página: `/blog`
Evidência: consulta à tabela `blog_posts` em produção (15/09/2026): `publicados = 0`, `rascunhos = 7`.
Impacto: um crawler que visite `/blog` hoje encontra uma página de listagem vazia — thin content num caminho que devia ser hub de autoridade.
Recomendação: sem alterar nada agora, mas a decisão de quando publicar os 7 rascunhos existentes deveria considerar isso: quanto antes sair do estado vazio, melhor.

**[P1]**
Problema: nenhum artigo de blog terá dado estruturado `Article`/`BlogPosting`, `author` ou `datePublished`/`dateModified` quando publicado.
Página: `/blog/$slug` (template)
Evidência: [`src/routes/blog.$slug.tsx:117-130`](../src/routes/blog.$slug.tsx) — o `head()` só define `meta`/`links`, sem `scripts` de JSON-LD (diferente da Home, que usa `jsonLdFaq`).
Impacto: perde elegibilidade a rich results de artigo (ex.: data de publicação no snippet, autor) e sinal de E-E-A-T estruturado.
Recomendação: quando decidir tratar disso, seguir o mesmo padrão já usado (`src/lib/jsonld.ts` + `tagJsonLd`), gerado a partir dos mesmos campos que já existem em `blog_posts` (`titulo`, `publicado_em`, `capa_url`).

**[P2]**
Problema: `/ajuda` tem 18 perguntas e respostas visíveis sem `FAQPage` estruturado.
Página: `/ajuda`
Evidência: `src/routes/ajuda.tsx` define `CATEGORIAS` (6×3 perguntas) só como dado de UI; `jsonLdFaq` (já existe e é usado na Home) não é chamado aqui.
Impacto: perde chance de rich result de FAQ pra buscas de suporte/dúvida sobre o produto.
Recomendação: reaproveitar `jsonLdFaq(perguntas)` com o mesmo array já usado na tela.

**[P2]**
Problema: `/quiz` e `/manual` não recebem nenhum link interno do site.
Páginas: `/quiz`, `/manual`
Evidência: nenhuma ocorrência de `to="/quiz"` ou `to="/manual"` em `SiteHeader.tsx`, `SiteFooter.tsx`, `index.tsx`, `sobre.tsx`, `ajuda.tsx`, `blog.index.tsx`, `blog.$slug.tsx`.
Impacto: dependem inteiramente de tráfego externo (bio do Instagram) e do sitemap; zero autoridade interna flui pra elas, o que também as deixa mais vulneráveis a nunca aparecerem bem em busca orgânica própria (só via branded/direct).
Recomendação: se o objetivo de cada uma for só capturar quem já vem do Instagram, tudo bem como está — decisão de arquitetura, não bug. Se quiserem também competir por busca orgânica um dia, vão precisar de pelo menos um link interno contextual (ex.: blog).

**[P2]**
Problema: nenhum dos 7 rascunhos de blog tem imagem de capa.
Página: futuros `/blog/$slug`
Evidência: consulta SQL, `sem_capa = 7` de 7.
Impacto: se publicados como estão, todos os posts vão cair no bloco de cor sólida (sem imagem real) e compartilhar o mesmo `og:image` genérico do site ao serem compartilhados em redes sociais — menos diferenciação, menos CTR no compartilhamento.
Recomendação: decisão editorial (não é bug de código, o campo existe e é opcional).

**[P2]**
Problema: meta description da Home (192 caracteres) e do Manual (178 caracteres) excedem o limite prático de exibição do Google (~155-160).
Páginas: `/`, `/manual`
Evidência: `src/routes/index.tsx:29-31`, `src/routes/manual.tsx:66-69`.
Impacto: o snippet de busca deve truncar no meio da frase, cortando o fecho da mensagem.
Recomendação: revisão editorial pra encurtar, mantendo a primeira metade (que já carrega a promessa principal em ambos os casos).

**[P3]**
Problema: title de `/sobre` (18 caracteres) e `/ajuda` (13 caracteres) são curtos e genéricos.
Páginas: `/sobre`, `/ajuda`
Evidência: `src/routes/sobre.tsx:20`, `src/routes/ajuda.tsx:38`.
Impacto: baixo — desperdiça espaço de SERP disponível, mas não impede indexação nem gera erro.
Recomendação: oportunidade editorial de baixo esforço.

**[P3]**
Problema: `/sobre` pula de H2 pra H3 sem heading H2 próprio na seção "Missão e Visão".
Página: `/sobre`
Evidência: `src/routes/sobre.tsx:617-644` (`Eyebrow` + `<h3>Missão</h3>`/`<h3>Visão</h3>` direto, sem `<h2>` entre eles e a seção anterior).
Impacto: mínimo (não quebra acessibilidade nem indexação), inconsistência de padrão.
Recomendação: opcional.

**[P3]**
Problema: texto de fechamento "Clareza sobre o negócio gera lucro." é `<p>` com estilo visual de heading em pelo menos 2 páginas (Home, Sobre).
Páginas: `/`, `/sobre`
Evidência: `src/routes/index.tsx:1230`, `src/routes/sobre.tsx:759`.
Impacto: nenhum pra SEO; relevante só pra quem for revisar consistência semântica/acessibilidade.
Recomendação: opcional, trocar por `<p>` intencional documentado ou heading real.

**[P3]**
Problema: capas de post/card de blog usam `alt=""` mesmo quando a imagem é a capa editorial do artigo (não puramente decorativa).
Páginas: `/blog`, `/blog/$slug`
Evidência: `src/routes/blog.index.tsx:66`, `src/routes/blog.$slug.tsx:166` e `251`.
Impacto: baixo (defensável tecnicamente, já que o título aparece como texto ao lado) — mas é uma oportunidade perdida de SEO de imagem quando a capa for realmente ilustrativa do conteúdo.
Recomendação: opcional, avaliar caso a caso quando o blog tiver posts reais com capa.

**[P3]**
Problema: `api.fontshare.com` (fonte Cabinet Grotesk) não tem `preconnect`, diferente de `fonts.googleapis.com`/`fonts.gstatic.com`.
Página: todas (via `__root.tsx`)
Evidência: `src/routes/__root.tsx:110-126`.
Impacto: risco pequeno de troca de fonte visível nos títulos por chegar depois das outras fontes.
Recomendação: opcional, adicionar `preconnect` pro domínio da Fontshare.

---

## 14. Não mexer

Lista do que já está bem resolvido e não deveria ser tocado só por causa de SEO:

- **Host canônico único com 301 automático** (www, workers.dev) — `src/lib/seo.ts` + `src/server.ts`. Simples, testado, documentado.
- **`X-Robots-Tag: noindex, nofollow` via header HTTP** em toda rota autenticada, independente de o React montar ou não — mais robusto que confiar só em meta tag client-side.
- **Sitemap dinâmico com fallback pras estáticas** se a busca de posts falhar, em vez de derrubar o sitemap inteiro.
- **Canonical gerado por função única (`urlCanonica`/`linkCanonico`)**, nunca escrito à mão por rota — impossível divergir do host oficial por engano.
- **FAQ estruturado gerado do mesmo array que renderiza a UI** (Home) — impede dessincronia entre o que o schema diz e o que a usuária vê.
- **Loader server-side pro blog** (não `useEffect`) garantindo que o HTML servido já tenha os links dos posts — decisão certa de arquitetura, já pensando em crawler.
- **Imagens do `/sobre` com `width`/`height` explícitos, `fetchPriority="high"` na de LCP, `loading="lazy"` nas demais, e `<picture>` com WebP responsivo** — bem feito, não mexer.
- **Ausência quase total de foto de banco/imagem decorativa genérica** — o site é leve em peso de imagem por escolha de marca, isso também ajuda performance.
- **Robots.txt sem bloqueio de buscador**, só de crawler de treino de IA — decisão de negócio já tomada, não é technical debt.
- **Honeypot + Turnstile nos formulários públicos** (`/ajuda`, `/pesquisa`, `/quiz`, `/manual`, `/lista-de-espera`) — proteção antispam que não interfere em SEO nem em UX de humano.
- **GA4 só carrega após consentimento de cookie, nunca no domínio de gestão** — não é enfeite, é compliance + performance ao mesmo tempo.

---

## 15-20. Índice de navegação deste documento

Pra facilitar: as seções pedidas 15 a 20 (blog, E-E-A-T, performance, keywords, canibalização, plano de ação) foram intercaladas nas seções 7, 8, 10, 12, 12/17 e abaixo, respectivamente, seguindo a mesma ordem lógica. Segue o plano de ação como fechamento.

## Plano de ação recomendado (para decisão futura, nada aqui foi executado)

1. Decidir o destino de `/pesquisa` (isca pública com `noindex` explícito, como `/quiz`/`/manual`, ou bloqueio total) — é o único ponto realmente ambíguo do site.
2. Adicionar `FAQPage` em `/ajuda` reaproveitando `jsonLdFaq` já existente — menor esforço, ganho direto de rich result.
3. Definir um padrão de `Article`/`BlogPosting` + `author` pra quando os 7 rascunhos forem publicados (antes de publicar o primeiro, pra não ter que retrofitar 7 posts depois).
4. Revisar as 2 meta descriptions acima do limite (Home, Manual).
5. Avaliar se `/quiz` e `/manual` merecem 1 link interno contextual (ex.: um bloco no `/blog` ou no footer) ou se o isolamento é intencional e deve continuar.
6. Ajustes de baixo esforço (title de `/sobre`/`/ajuda`, preconnect da Fontshare, hierarquia H2/H3 de `/sobre`) — fazer junto de qualquer outra manutenção da página, não como projeto isolado.
