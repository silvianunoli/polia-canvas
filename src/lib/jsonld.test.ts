import { describe, expect, it } from "vitest";
import {
  jsonLdAboutPage,
  jsonLdBlogPosting,
  jsonLdBreadcrumb,
  jsonLdFaq,
  jsonLdOrganization,
  jsonLdPersonSil,
  jsonLdWebSite,
  tagJsonLd,
} from "./jsonld";

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

describe("jsonLdPersonSil", () => {
  it("é a Sil, fundadora, ligada à Organization e à própria página /sobre", () => {
    const pessoa = jsonLdPersonSil() as {
      "@type": string;
      name: string;
      jobTitle: string;
      url: string;
      worksFor: { "@type": string; name: string };
    };
    expect(pessoa["@type"]).toBe("Person");
    expect(pessoa.name).toBe("Sil");
    expect(pessoa.jobTitle).toBe("Fundadora");
    expect(pessoa.url).toBe("https://usepolia.com.br/sobre");
    expect(pessoa.worksFor["@type"]).toBe("Organization");
    expect(pessoa.worksFor.name).toBe("Pólia");
  });

  it("não inventa rede social nem credencial", () => {
    const proibidos = ["sameAs", "alumniOf", "award", "telephone", "email"];
    for (const campo of proibidos) {
      expect(jsonLdPersonSil()).not.toHaveProperty(campo);
    }
  });
});

describe("jsonLdAboutPage", () => {
  it("usa o nome/url/descrição recebidos e aponta pra Organization como mainEntity", () => {
    const pagina = jsonLdAboutPage({
      nome: "Nome de teste",
      url: "https://usepolia.com.br/sobre",
      descricao: "Descrição de teste.",
    }) as {
      "@type": string;
      name: string;
      url: string;
      description: string;
      mainEntity: { name: string };
    };
    expect(pagina["@type"]).toBe("AboutPage");
    expect(pagina.name).toBe("Nome de teste");
    expect(pagina.url).toBe("https://usepolia.com.br/sobre");
    expect(pagina.description).toBe("Descrição de teste.");
    expect(pagina.mainEntity.name).toBe("Pólia");
  });
});

describe("jsonLdBlogPosting", () => {
  const base = {
    titulo: "Faturamento não é o mesmo que dinheiro que sobra",
    descricao: "Entenda a diferença entre o que entra e o que sobra.",
    urlCanonica: "https://usepolia.com.br/blog/faturamento-nao-e-o-mesmo-que-dinheiro-que-sobra",
    imagem: null as string | null,
    publicadoEm: null as string | null,
    atualizadoEm: "2026-09-08T02:25:06.571Z",
  };

  it("sempre inclui author, publisher, dateModified, url e mainEntityOfPage", () => {
    const post = jsonLdBlogPosting(base) as {
      "@type": string;
      headline: string;
      author: { name: string };
      publisher: { name: string };
      dateModified: string;
      url: string;
      mainEntityOfPage: { "@id": string };
    };
    expect(post["@type"]).toBe("BlogPosting");
    expect(post.headline).toBe(base.titulo);
    expect(post.author.name).toBe("Sil");
    expect(post.publisher.name).toBe("Pólia");
    expect(post.dateModified).toBe(base.atualizadoEm);
    expect(post.url).toBe(base.urlCanonica);
    expect(post.mainEntityOfPage["@id"]).toBe(base.urlCanonica);
  });

  it("omite datePublished e image quando o post não tem esses dados", () => {
    const post = jsonLdBlogPosting(base);
    expect(post).not.toHaveProperty("datePublished");
    expect(post).not.toHaveProperty("image");
  });

  it("inclui datePublished e image só quando existem de verdade", () => {
    const post = jsonLdBlogPosting({
      ...base,
      publicadoEm: "2026-09-20T10:00:00.000Z",
      imagem: "https://usepolia.com.br/marketing/capa.jpg",
    }) as { datePublished: string; image: string };
    expect(post.datePublished).toBe("2026-09-20T10:00:00.000Z");
    expect(post.image).toBe("https://usepolia.com.br/marketing/capa.jpg");
  });
});

describe("jsonLdBreadcrumb", () => {
  it("numera a posição em ordem, a partir de 1", () => {
    const trilha = jsonLdBreadcrumb([
      { nome: "Início", url: "https://usepolia.com.br/" },
      { nome: "Blog", url: "https://usepolia.com.br/blog" },
      { nome: "Um post", url: "https://usepolia.com.br/blog/um-post" },
    ]) as {
      "@type": string;
      itemListElement: Array<{ position: number; name: string; item: string }>;
    };

    expect(trilha["@type"]).toBe("BreadcrumbList");
    expect(trilha.itemListElement).toHaveLength(3);
    expect(trilha.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(trilha.itemListElement[2].name).toBe("Um post");
    expect(trilha.itemListElement[2].item).toBe("https://usepolia.com.br/blog/um-post");
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
