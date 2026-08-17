import { describe, expect, it } from "vitest";
import { jsonLdFaq, jsonLdOrganization, jsonLdWebSite, tagJsonLd } from "./jsonld";

const PERGUNTAS = [
  { pergunta: "A Pólia é um curso?", resposta: "É uma ferramenta de uso diário." },
  { pergunta: "Precisa de planilha?", resposta: "Não. A Pólia faz as contas sozinha." },
];

describe("jsonLdFaq", () => {
  it("gera uma Question por pergunta do array, na mesma ordem", () => {
    const faq = jsonLdFaq(PERGUNTAS) as {
      "@type": string;
      mainEntity: Array<{ "@type": string; name: string; acceptedAnswer: { text: string } }>;
    };

    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity).toHaveLength(PERGUNTAS.length);
    expect(faq.mainEntity[0].name).toBe("A Pólia é um curso?");
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("É uma ferramenta de uso diário.");
    expect(faq.mainEntity[1].name).toBe("Precisa de planilha?");
  });

  it("aguenta array vazio sem quebrar", () => {
    const faq = jsonLdFaq([]) as { mainEntity: unknown[] };
    expect(faq.mainEntity).toEqual([]);
  });
});

describe("jsonLdOrganization e jsonLdWebSite", () => {
  it("usam o domínio próprio e o SVG oficial do logo", () => {
    const org = jsonLdOrganization() as { url: string; logo: string; name: string };
    expect(org.name).toBe("Pólia");
    expect(org.url).toBe("https://usepolia.com.br");
    expect(org.logo).toBe("https://usepolia.com.br/marketing/logo.svg");

    const site = jsonLdWebSite() as { url: string; name: string };
    expect(site.name).toBe("Pólia");
    expect(site.url).toBe("https://usepolia.com.br");
  });

  it("não inventa campo que ninguém deu", () => {
    const proibidos = ["aggregateRating", "review", "price", "sameAs", "telephone", "address"];
    for (const bloco of [jsonLdOrganization(), jsonLdWebSite()]) {
      for (const campo of proibidos) {
        expect(bloco).not.toHaveProperty(campo);
      }
    }
  });
});

describe("tagJsonLd", () => {
  it("devolve o script pronto pro head()", () => {
    const tag = tagJsonLd({ "@type": "WebSite" });
    expect(tag.type).toBe("application/ld+json");
    expect(JSON.parse(tag.children)).toEqual({ "@type": "WebSite" });
  });

  it("escapa < pra que resposta com HTML não feche a tag script", () => {
    const tag = tagJsonLd(
      jsonLdFaq([{ pergunta: "E aí?", resposta: "Olha isto: </script><img src=x>" }]),
    );

    expect(tag.children).not.toContain("</script>");
    expect(tag.children).not.toContain("<");
    expect(tag.children).toContain("\\u003c");
    // O escape mantém o JSON válido e o texto original intacto.
    const dado = JSON.parse(tag.children) as {
      mainEntity: Array<{ acceptedAnswer: { text: string } }>;
    };
    expect(dado.mainEntity[0].acceptedAnswer.text).toBe("Olha isto: </script><img src=x>");
  });
});
