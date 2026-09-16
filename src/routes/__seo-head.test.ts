// Verifica o head() das rotas públicas tocadas na auditoria de SEO — o mesmo
// objeto que vira <meta>/<link>/<script> na página renderizada. Não é teste
// de UI: é a prova de que a diretiva/schema certo sai do route file, sem
// precisar de navegador nem de servidor de pé.
import { describe, expect, it } from "vitest";
import { Route as PesquisaRoute } from "./pesquisa";
import { Route as BlogIndexRoute } from "./blog.index";
import { Route as BlogSlugRoute } from "./blog.$slug";
import { Route as AjudaRoute } from "./ajuda";
import { Route as SobreRoute } from "./sobre";

type Head = {
  meta?: Array<Record<string, string>>;
  links?: Array<Record<string, string>>;
  scripts?: Array<{ type: string; children: string }>;
};

// As rotas geram tipo de `head` bem específico (contexto de asset do TanStack
// Start); aqui só nos interessa chamar a função e ler o objeto de volta, então
// o cast pra "qualquer função" é deliberado, não descuido de tipagem.
function head(route: { options: { head?: unknown } }, ...args: unknown[]): Head {
  const fn = route.options.head as ((...a: unknown[]) => Head) | undefined;
  if (!fn) throw new Error("rota sem head()");
  return fn(...args);
}

describe("/pesquisa", () => {
  it("tem robots noindex,follow e continua com canonical", () => {
    const h = head(PesquisaRoute);
    expect(h.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
    expect(h.links).toContainEqual({
      rel: "canonical",
      href: "https://one.usepolia.com.br/pesquisa",
    });
  });
});

describe("/blog", () => {
  it("emite BreadcrumbList Início > Blog", () => {
    const h = head(BlogIndexRoute);
    const script = h.scripts?.[0];
    expect(script?.type).toBe("application/ld+json");
    const dado = JSON.parse(script!.children) as {
      "@type": string;
      itemListElement: Array<{ name: string; item: string }>;
    };
    expect(dado["@type"]).toBe("BreadcrumbList");
    expect(dado.itemListElement.map((i) => i.name)).toEqual(["Início", "Blog"]);
    expect(dado.itemListElement[1].item).toBe("https://one.usepolia.com.br/blog");
  });
});

describe("/blog/$slug", () => {
  const post = {
    id: "id-1",
    slug: "exemplo",
    titulo: "Título de exemplo",
    resumo: "Resumo de exemplo.",
    categoria: "Precificação",
    conteudo_md: "texto",
    capa_url: null as string | null,
    publicado_em: null as string | null,
    tempo_leitura: 2,
    updated_at: "2026-09-08T02:25:06.571Z",
  };

  it("emite BlogPosting e BreadcrumbList quando o post existe", () => {
    const h = head(BlogSlugRoute, {
      loaderData: { post, related: [] },
      params: { slug: post.slug },
    });
    expect(h.scripts).toHaveLength(2);

    const posting = JSON.parse(h.scripts![0].children) as {
      "@type": string;
      headline: string;
      author: { name: string };
      publisher: { name: string };
      dateModified: string;
      url: string;
    };
    expect(posting["@type"]).toBe("BlogPosting");
    expect(posting.headline).toBe(post.titulo);
    expect(posting.author.name).toBe("Sil");
    expect(posting.publisher.name).toBe("Pólia");
    expect(posting.dateModified).toBe(post.updated_at);
    expect(posting).not.toHaveProperty("datePublished"); // publicado_em é null aqui
    expect(posting).not.toHaveProperty("image"); // capa_url é null aqui

    const trilha = JSON.parse(h.scripts![1].children) as {
      "@type": string;
      itemListElement: Array<{ name: string }>;
    };
    expect(trilha["@type"]).toBe("BreadcrumbList");
    expect(trilha.itemListElement.map((i) => i.name)).toEqual(["Início", "Blog", post.titulo]);
  });

  it("não emite schema nenhum sem loaderData (erro/pendente)", () => {
    const h = head(BlogSlugRoute, { loaderData: undefined, params: { slug: "x" } });
    expect(h.scripts).toEqual([]);
  });
});

describe("/ajuda", () => {
  it("emite FAQPage com todas as perguntas visíveis na página", () => {
    const h = head(AjudaRoute);
    const dado = JSON.parse(h.scripts![0].children) as {
      "@type": string;
      mainEntity: Array<{ name: string }>;
    };
    expect(dado["@type"]).toBe("FAQPage");
    // 6 categorias × 3 perguntas, na tela hoje.
    expect(dado.mainEntity).toHaveLength(18);
    expect(dado.mainEntity[0].name).toBe("Por onde começar no Planejamento");
  });
});

describe("/sobre", () => {
  it("emite AboutPage e Person, sem inventar rede social nem credencial", () => {
    const h = head(SobreRoute);
    expect(h.scripts).toHaveLength(2);

    const sobre = JSON.parse(h.scripts![0].children) as { "@type": string; url: string };
    expect(sobre["@type"]).toBe("AboutPage");
    expect(sobre.url).toBe("https://one.usepolia.com.br/sobre");

    const pessoa = JSON.parse(h.scripts![1].children) as {
      "@type": string;
      name: string;
      jobTitle: string;
    };
    expect(pessoa["@type"]).toBe("Person");
    expect(pessoa.name).toBe("Sil");
    expect(pessoa.jobTitle).toBe("Fundadora");
    expect(pessoa).not.toHaveProperty("sameAs");
  });
});
