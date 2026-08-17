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

export function jsonLdOrganization(): object {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: NOME,
    url: HOST_CANONICO,
    logo: urlCanonica("/marketing/logo.svg"),
  };
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
