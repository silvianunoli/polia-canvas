import { describe, expect, it } from "vitest";
import { lojaDoDominioValida, paraDentro, paraFora, urlNoDominio } from "./lojaDominio";

describe("lojaDoDominioValida", () => {
  it("aceita endereço e domínio válidos, em minúsculas", () => {
    expect(lojaDoDominioValida("Loveless-Crochet", "LovelessCrochet.com.br")).toEqual({
      slug: "loveless-crochet",
      dominio: "lovelesscrochet.com.br",
    });
  });
  it("recusa vazio, formato estranho e o domínio da própria Pólia", () => {
    expect(lojaDoDominioValida(undefined, "lovelesscrochet.com.br")).toBeNull();
    expect(lojaDoDominioValida("ab", "lovelesscrochet.com.br")).toBeNull();
    expect(lojaDoDominioValida("loveless-crochet", "lovelesscrochet")).toBeNull();
    expect(lojaDoDominioValida("loveless-crochet", "evil.com/x")).toBeNull();
    expect(lojaDoDominioValida("loveless-crochet", "one.usepolia.com.br")).toBeNull();
    expect(lojaDoDominioValida("loveless-crochet", "localhost")).toBeNull();
  });
});

describe("paraDentro e paraFora", () => {
  const slug = "loveless-crochet";
  it("põe o endereço da loja na frente", () => {
    expect(paraDentro("/", slug)).toBe("/loja/loveless-crochet");
    expect(paraDentro("", slug)).toBe("/loja/loveless-crochet");
    expect(paraDentro("/abc-123", slug)).toBe("/loja/loveless-crochet/abc-123");
  });
  it("não põe duas vezes", () => {
    expect(paraDentro("/loja/loveless-crochet", slug)).toBe("/loja/loveless-crochet");
    expect(paraDentro("/loja/loveless-crochet/abc", slug)).toBe("/loja/loveless-crochet/abc");
  });
  it("tira o endereço da loja dos links", () => {
    expect(paraFora("/loja/loveless-crochet", slug)).toBe("/");
    expect(paraFora("/loja/loveless-crochet/", slug)).toBe("/");
    expect(paraFora("/loja/loveless-crochet/abc", slug)).toBe("/abc");
  });
  it("não mexe no que não é da loja (nem em loja de nome parecido)", () => {
    expect(paraFora("/privacidade", slug)).toBe("/privacidade");
    expect(paraFora("/loja/loveless-crochetx/abc", slug)).toBe("/loja/loveless-crochetx/abc");
  });
  it("ida e volta dá o mesmo caminho", () => {
    for (const c of ["/", "/abc", "/abc/def"]) expect(paraFora(paraDentro(c, slug), slug)).toBe(c);
  });
});

describe("urlNoDominio", () => {
  it("monta a URL no domínio da marca", () => {
    const loja = { slug: "loveless-crochet", dominio: "lovelesscrochet.com.br" };
    expect(urlNoDominio("/loja/loveless-crochet", loja)).toBe("https://lovelesscrochet.com.br/");
    expect(urlNoDominio("/loja/loveless-crochet/abc", loja)).toBe(
      "https://lovelesscrochet.com.br/abc",
    );
  });
});
