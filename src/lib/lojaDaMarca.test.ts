import { describe, expect, it } from "vitest";
import {
  arquivosQueSairam,
  corpoDaVitrine,
  detalhesParaSalvar,
  lerBanners,
  lerDetalhes,
  lerTitulos,
  problemaDoLink,
  problemaDosDetalhes,
  problemaParaSalvar,
  titulosVisiveis,
} from "./lojaDaMarca";

describe("titulosVisiveis", () => {
  it("segue a ordem dos blocos da loja e ignora bloco sem título", () => {
    expect(
      titulosVisiveis(["abertura", "destaques", "produtos", "selos"]).map((t) => t.bloco),
    ).toEqual(["destaques", "produtos"]);
  });

  it("sem blocos gravados, mostra os quatro carrosséis", () => {
    expect(titulosVisiveis(undefined).map((t) => t.bloco)).toEqual([
      "produtos",
      "atalhos",
      "destaques",
      "rotina",
    ]);
  });
});

describe("lerTitulos e lerBanners", () => {
  it("o que falta vira vazio, sem quebrar", () => {
    const t = lerTitulos({ produtos: { titulo: "Mais Vendidos" }, rotina: "torto" });
    expect(t.produtos).toEqual({ titulo: "Mais Vendidos", acima: "" });
    expect(t.rotina).toEqual({ titulo: "", acima: "" });
  });

  it("banner sem imagem some", () => {
    expect(
      lerBanners([{ imagem_path: "u/a.png", link: "/produtos", alt: "A" }, { link: "/x" }, null]),
    ).toEqual([{ imagemPath: "u/a.png", celularPath: null, link: "/produtos", alt: "A" }]);
  });
});

describe("problemaDoLink", () => {
  it("aceita caminho da loja, https e vazio", () => {
    expect(problemaDoLink("/categoria/natal")).toBeNull();
    expect(problemaDoLink("https://wa.me/55")).toBeNull();
    expect(problemaDoLink("  ")).toBeNull();
  });

  it("recusa http, javascript e caminho com duas barras", () => {
    expect(problemaDoLink("http://site.com")).not.toBeNull();
    expect(problemaDoLink("javascript:alert(1)")).not.toBeNull();
    expect(problemaDoLink("//outro.com")).not.toBeNull();
  });
});

describe("salvar", () => {
  const banner = { imagemPath: "u/a.png", celularPath: null, link: "", alt: "Banner" };

  it("aponta o banner com link torto", () => {
    expect(problemaParaSalvar({}, [banner, { ...banner, link: "ftp://x" }])).toMatch(/^Banner 2/);
  });

  it("título longo trava", () => {
    expect(
      problemaParaSalvar({ produtos: { titulo: "x".repeat(61), acima: "" } }, []),
    ).not.toBeNull();
  });

  it("link vazio vai como null e o texto vai aparado", () => {
    expect(
      corpoDaVitrine({ produtos: { titulo: " Mais Vendidos ", acima: "" } }, [banner]),
    ).toEqual({
      p_rotulos: { produtos: { titulo: "Mais Vendidos", acima: "" } },
      p_banners: [{ imagem_path: "u/a.png", imagem_celular_path: null, link: null, alt: "Banner" }],
    });
  });

  it("lista só os arquivos que não ficaram em nenhum banner", () => {
    const antes = [
      banner,
      { imagemPath: "u/b.png", celularPath: "u/b-cel.png", link: "", alt: "" },
    ];
    expect(arquivosQueSairam(antes, [banner])).toEqual(["u/b.png", "u/b-cel.png"]);
  });
});

describe("detalhes do produto", () => {
  it("lê o banco e ignora linha torta", () => {
    expect(lerDetalhes([{ nome: "Capacidade", valor: "325 ml" }, "x", null])).toEqual([
      { nome: "Capacidade", valor: "325 ml" },
    ]);
    expect(lerDetalhes("torto")).toEqual([]);
  });

  it("linha toda vazia sai, o resto vai aparado", () => {
    expect(
      detalhesParaSalvar([
        { nome: " Material ", valor: " Cerâmica " },
        { nome: " ", valor: "" },
      ]),
    ).toEqual([{ nome: "Material", valor: "Cerâmica" }]);
  });

  it("linha pela metade, longa ou demais trava", () => {
    expect(problemaDosDetalhes([{ nome: "Altura", valor: "" }])).toMatch(/linha 1/);
    expect(problemaDosDetalhes([{ nome: "x".repeat(61), valor: "1" }])).not.toBeNull();
    expect(
      problemaDosDetalhes(Array.from({ length: 21 }, (_, i) => ({ nome: `n${i}`, valor: "v" }))),
    ).not.toBeNull();
    expect(problemaDosDetalhes([{ nome: "Altura", valor: "9,5 cm" }])).toBeNull();
  });
});
