// Dados estruturados (JSON-LD): o que o Google usa pra entender que a home tem
// um FAQ e que existe uma organização por trás do site.
//
// Regra deste arquivo: nada de campo inventado. Sem aggregateRating, sem
// review, sem price, sem sameAs de rede social. Só o que dá pra sustentar
// olhando o próprio site.
import { HOST_CANONICO, urlCanonica } from "./seo";

const NOME = "Pólia";

export type PerguntaFrequente = {
  pergunta: string;
  resposta: string;
};

/**
 * FAQPage montado A PARTIR do array de perguntas da home, nunca duplicando o
 * texto à mão: duas fontes de verdade divergem na primeira edição de copy, e
 * FAQ estruturado que não bate com a página visível é penalizado.
 */
export function jsonLdFaq(perguntas: ReadonlyArray<PerguntaFrequente>): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: perguntas.map(({ pergunta, resposta }) => ({
      "@type": "Question",
      name: pergunta,
      acceptedAnswer: {
        "@type": "Answer",
        text: resposta,
      },
    })),
  };
}

/** Organization sem `@context`, pra usar aninhado (`publisher`, `worksFor`) sem repetir o contexto. */
function organizacaoRef(): object {
  return {
    "@type": "Organization",
    name: NOME,
    url: HOST_CANONICO,
    logo: urlCanonica("/logotipo-wordmark-ligth-one.svg"),
  };
}

export function jsonLdOrganization(): object {
  return { "@context": "https://schema.org", ...organizacaoRef() };
}

export function jsonLdWebSite(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: NOME,
    url: HOST_CANONICO,
    inLanguage: "pt-BR",
  };
}

/**
 * Person da Sil sem `@context`, pra usar aninhado (`author` do BlogPosting).
 * Só campos já públicos e repetidos em `/sobre` e na assinatura dos posts:
 * nome, cargo ("fundadora"), URL da própria página e a organização. Nada de
 * rede social ou credencial que não esteja escrita em algum lugar do site.
 */
function pessoaSilRef(): object {
  return {
    "@type": "Person",
    name: "Sil",
    jobTitle: "Fundadora",
    url: urlCanonica("/sobre"),
    worksFor: organizacaoRef(),
  };
}

export function jsonLdPersonSil(): object {
  return { "@context": "https://schema.org", ...pessoaSilRef() };
}

/**
 * AboutPage de `/sobre`. `mainEntity` aponta pra Organization porque a página
 * conta a história da Pólia (a empresa) através da fundadora — não é uma
 * bio isolada da Sil, que já tem o Person próprio na mesma página.
 */
export function jsonLdAboutPage(dado: { nome: string; url: string; descricao: string }): object {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: dado.nome,
    url: dado.url,
    description: dado.descricao,
    mainEntity: organizacaoRef(),
  };
}

export type DadoBlogPosting = {
  titulo: string;
  descricao: string;
  urlCanonica: string;
  /** URL absoluta da capa, se existir. Sem capa, o campo `image` não entra no schema. */
  imagem: string | null;
  /** ISO 8601. Sem data de publicação real, o campo `datePublished` não entra no schema. */
  publicadoEm: string | null;
  /** ISO 8601, sempre presente (`blog_posts.updated_at` não aceita nulo). */
  atualizadoEm: string;
};

/**
 * BlogPosting de `/blog/$slug`. Todo campo vem do próprio post (banco) ou de
 * dado já usado em outro lugar do site (autora, organização, domínio) — nada
 * inventado. `datePublished`/`image` só entram quando o dado existe de verdade.
 */
export function jsonLdBlogPosting(dado: DadoBlogPosting): object {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: dado.titulo,
    description: dado.descricao,
    url: dado.urlCanonica,
    mainEntityOfPage: { "@type": "WebPage", "@id": dado.urlCanonica },
    author: pessoaSilRef(),
    publisher: organizacaoRef(),
    dateModified: dado.atualizadoEm,
  };
  if (dado.publicadoEm) schema.datePublished = dado.publicadoEm;
  if (dado.imagem) schema.image = dado.imagem;
  return schema;
}

export type ItemBreadcrumb = { nome: string; url: string };

/** BreadcrumbList só como dado estruturado — sem trilha visual nova na página. */
export function jsonLdBreadcrumb(itens: ReadonlyArray<ItemBreadcrumb>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map((item, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: item.nome,
      item: item.url,
    })),
  };
}

/**
 * Serializa pra dentro de <script type="application/ld+json">.
 *
 * O conteúdo entra no HTML como innerHTML, então "<" precisa virar escape
 * unicode: um "</script>" dentro de uma resposta do FAQ fecharia a tag e
 * jogaria o resto da copy como HTML na página. O JSON continua válido, porque
 * < é um escape legítimo de string JSON.
 */
export function tagJsonLd(dado: object): { type: string; children: string } {
  const json = JSON.stringify(dado)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return { type: "application/ld+json", children: json };
}
