import { describe, expect, it } from "vitest";
import { ISCAS, SLUG_ISCA, buscarIsca } from "./catalogo";
import { caminhoDownloadIsca, slugDoDownloadDeIsca, urlDownloadIsca } from "./download";
import { montarEmailIsca } from "./email";

// Vocabulário que não entra em texto visível (CLAUDE.md da raiz, Regra nº 3).
const PROIBIDAS = [
  /—/,
  /–/,
  /\bjornada\b/i,
  /\betapa\b/i,
  /\btrilha\b/i,
  /no seu ritmo/i,
  /no seu tempo/i,
  /do seu jeito/i,
  /\bmargem\b/i,
  /quanto sobra/i,
  /infoproduto/i,
  /\bturma\b/i,
  /fatura mais/i,
];

function textosVisiveis(i: (typeof ISCAS)[string]): string[] {
  return [
    i.rotulo,
    i.titulo,
    i.subtitulo,
    i.nomeCurto,
    i.cta,
    i.descricao,
    i.consentTexto,
    ...i.bullets,
    i.email.assunto,
    i.email.preheader,
    i.email.headline,
    i.email.cta,
    i.email.fechamento,
    ...i.email.paragrafos,
  ];
}

describe("catálogo das iscas", () => {
  const todas = Object.values(ISCAS);

  it("tem a isca da Black Friday com o título e o arquivo combinados", () => {
    const bf = buscarIsca("black-friday");
    expect(bf?.titulo).toBe("Black Friday sem queimar o lucro");
    expect(bf?.nomeArquivo).toBe("checklist-black-friday-polia.pdf");
    expect(bf?.objeto).toBe("checklist-black-friday-polia.pdf");
  });

  it.each(todas.map((i) => [i.slug, i] as const))("%s: entrada coerente", (chave, i) => {
    expect(ISCAS[chave].slug).toBe(chave);
    expect(SLUG_ISCA.test(i.slug)).toBe(true);
    expect(i.cta.startsWith("Quero")).toBe(true);
    expect(i.bullets.length).toBeGreaterThan(0);
    // Vai pro content-disposition: sem aspas, espaço ou acento.
    expect(i.nomeArquivo).toMatch(/^[a-z0-9-]+\.pdf$/);
    expect(i.objeto).toMatch(/^[a-z0-9/-]+\.pdf$/);
    expect(i.origemPadrao).toMatch(/^[a-z0-9_-]{1,40}$/i);
    if (i.destaque) expect(i.titulo).toContain(i.destaque);
    // Régua contida no e-mail de entrega: sem exclamação.
    expect(i.email.assunto).not.toContain("!");
  });

  it.each(todas.map((i) => [i.slug, i] as const))("%s: sem vocabulário proibido", (_, i) => {
    for (const t of textosVisiveis(i)) {
      for (const p of PROIBIDAS) expect(t, `"${t}" bate em ${p}`).not.toMatch(p);
    }
  });

  it("slug desconhecido, malformado ou de protótipo não vira isca", () => {
    for (const s of ["natal-2099", "Black-Friday", "../x", "", "constructor", "__proto__"]) {
      expect(buscarIsca(s)).toBeUndefined();
    }
    expect(buscarIsca(undefined)).toBeUndefined();
  });
});

describe("caminho de download das iscas", () => {
  it("monta e reconhece /materiais/<slug>/baixar", () => {
    expect(caminhoDownloadIsca("black-friday")).toBe("/materiais/black-friday/baixar");
    expect(slugDoDownloadDeIsca("/materiais/black-friday/baixar")).toBe("black-friday");
    expect(slugDoDownloadDeIsca("/materiais/black-friday/baixar/")).toBe("black-friday");
  });

  it("não confunde com a página nem com outros caminhos", () => {
    for (const p of [
      "/materiais/black-friday",
      "/materiais/baixar",
      "/manual/baixar",
      "/materiais/../baixar",
      "/materiais/Black/baixar",
      "/materiais/a/b/baixar",
    ]) {
      expect(slugDoDownloadDeIsca(p)).toBeNull();
    }
  });

  it("URL absoluta no host canônico, com o token na query", () => {
    expect(urlDownloadIsca("black-friday", "abc")).toBe(
      "https://one.usepolia.com.br/materiais/black-friday/baixar?t=abc",
    );
  });
});

describe("e-mail de entrega da isca", () => {
  const isca = ISCAS["black-friday"];
  const DOWNLOAD = "https://one.usepolia.com.br/materiais/black-friday/baixar?t=x";
  const DESCADASTRO = "https://one.usepolia.com.br/descadastrar?t=y";
  const email = montarEmailIsca({ isca, downloadUrl: DOWNLOAD, descadastroUrl: DESCADASTRO });

  it("assunto do catálogo, link de download e de descadastro nas duas versões", () => {
    expect(email.subject).toBe(isca.email.assunto);
    expect(email.text).toContain(DOWNLOAD);
    expect(email.html).toContain(`href="${DOWNLOAD}"`);
    expect(email.text).toContain(DESCADASTRO);
    expect(email.html).toContain(DESCADASTRO);
  });
});
