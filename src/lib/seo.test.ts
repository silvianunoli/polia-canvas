import { describe, expect, it } from "vitest";
import { deveRedirecionarParaHostCanonico, linkCanonico, urlCanonica } from "./seo";

describe("urlCanonica", () => {
  it("resolve a raiz com uma barra só", () => {
    expect(urlCanonica("/")).toBe("https://one.usepolia.com.br/");
    expect(urlCanonica("")).toBe("https://one.usepolia.com.br/");
  });

  it("aceita caminho com barra inicial", () => {
    expect(urlCanonica("/sobre")).toBe("https://one.usepolia.com.br/sobre");
    expect(urlCanonica("/blog/preco-no-chute")).toBe("https://one.usepolia.com.br/blog/preco-no-chute");
  });

  it("aceita caminho sem barra inicial", () => {
    expect(urlCanonica("sobre")).toBe("https://one.usepolia.com.br/sobre");
    expect(urlCanonica("blog/preco-no-chute")).toBe("https://one.usepolia.com.br/blog/preco-no-chute");
  });

  it("nunca devolve barra dupla", () => {
    for (const caminho of ["/", "//", "///sobre", "/sobre", "sobre", ""]) {
      const url = urlCanonica(caminho);
      expect(url.slice("https://".length)).not.toContain("//");
    }
  });
});

describe("linkCanonico", () => {
  it("devolve o objeto de link pronto pro head()", () => {
    expect(linkCanonico("/quiz")).toEqual({
      rel: "canonical",
      href: "https://one.usepolia.com.br/quiz",
    });
  });
});

describe("deveRedirecionarParaHostCanonico", () => {
  it("deixa passar o canonical novo e, na janela de transição, o apex e o www antigos", () => {
    expect(deveRedirecionarParaHostCanonico("one.usepolia.com.br")).toBe(false);
    expect(deveRedirecionarParaHostCanonico("usepolia.com.br")).toBe(false);
    expect(deveRedirecionarParaHostCanonico("www.usepolia.com.br")).toBe(false);
  });

  it("redireciona o fallback workers.dev", () => {
    expect(deveRedirecionarParaHostCanonico("tanstack-start-app.workers.dev")).toBe(true);
    expect(deveRedirecionarParaHostCanonico("tanstack-start-app.sil.workers.dev")).toBe(true);
  });

  it("deixa o desenvolvimento local em paz", () => {
    for (const host of ["localhost", "127.0.0.1", "0.0.0.0", "192.168.15.6", "app.localhost"]) {
      expect(deveRedirecionarParaHostCanonico(host)).toBe(false);
    }
  });
});
