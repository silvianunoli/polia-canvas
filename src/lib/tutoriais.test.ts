import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buscarTutoriais,
  duracaoDoTrecho,
  GRUPOS_TUTORIAL,
  planoDoTutorial,
  TRECHOS_USADOS,
  TUTORIAIS,
  tutorialDaRota,
  tutorialPorSlug,
  vizinhosDoTutorial,
} from "./tutoriais";

const textos = (t: (typeof TUTORIAIS)[number]) => [
  t.nome,
  t.resumo,
  t.abrir,
  ...t.passos.flatMap((p) => [p.titulo, ...p.itens]),
  ...t.bomSaber,
  ...t.duvidas.flatMap((d) => [d.pergunta, d.resposta]),
];

// Telas logadas que não precisam de tutorial, cada uma com o motivo. Tela nova
// fora daqui e sem tutorial faz o teste "toda tela logada tem tutorial" falhar
// (regra de 28/10/2026 no CLAUDE.md: tutorial acompanha a feature).
const SEM_TUTORIAL: Record<string, string> = {
  "/onboarding": "só redireciona pro Painel desde 14/10/2026",
  "/upgrade": "só decide pra onde mandar (assinar ou de volta)",
  "/chamados": "suporte, não é ferramenta",
  "/chamados/$id": "suporte, não é ferramenta",
  "/como-usar": "é o próprio tutorial",
  "/como-usar/$slug": "é o próprio tutorial",
  "/como-usar/tour": "é o próprio tutorial",
  "/mais": "aba Mais do app Android (AND-07): só lista as outras telas",
};

/** Arquivo de rota do TanStack (flat) → caminho: "produtos_.anuncios" → "/produtos/anuncios". */
function caminhoDaRota(arquivo: string): string {
  const partes = arquivo
    .replace(/\.tsx$/, "")
    .split(".")
    .map((p) => p.replace(/_$/, ""))
    .filter((p) => p !== "index");
  return "/" + partes.join("/");
}

describe("tutoriais por ferramenta", () => {
  it("toda tela logada tem tutorial (ou está em SEM_TUTORIAL com o motivo)", () => {
    const pasta = resolve(__dirname, "../routes/_authenticated");
    const caminhos = readdirSync(pasta)
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      .map(caminhoDaRota);
    expect(caminhos.length).toBeGreaterThan(20);
    const semTutorial = caminhos.filter((c) => !(c in SEM_TUTORIAL) && !tutorialDaRota(c));
    expect(
      semTutorial,
      "Tela sem tutorial: escreva um em src/lib/tutoriais.ts ou justifique em SEM_TUTORIAL",
    ).toEqual([]);
  });

  it("cobre todas as ferramentas do menu lateral, sem slug repetido", () => {
    const slugs = TUTORIAIS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const rota of [
      "/painel",
      "/planejamento",
      "/produtos",
      "/produtos/anuncios",
      "/vendas",
      "/calculadora",
      "/projecao",
      "/financeiro",
      "/raiox",
      "/clientes",
      "/metas",
      "/caderno",
      "/planner",
      "/plano-conteudo",
      "/calendario",
    ]) {
      expect(
        TUTORIAIS.some((t) => t.rota === rota),
        rota,
      ).toBe(true);
    }
  });

  it("todo tutorial está num grupo e tem passo a passo", () => {
    for (const t of TUTORIAIS) {
      expect(GRUPOS_TUTORIAL).toContain(t.grupo);
      expect(t.passos.length, t.slug).toBeGreaterThan(0);
      expect(
        t.passos.every((p) => p.itens.length > 0),
        t.slug,
      ).toBe(true);
    }
  });

  it("cada clipe tem duração e o mp3 cortado em public/video-tutorial/trechos", () => {
    for (const t of TUTORIAIS) {
      if (t.trecho) expect(duracaoDoTrecho(t.trecho), t.slug).not.toBeNull();
    }
    for (const trecho of TRECHOS_USADOS) {
      const mp3 = resolve(__dirname, "../../public/video-tutorial/trechos", `${trecho}.mp3`);
      expect(existsSync(mp3), mp3).toBe(true);
    }
  });

  it("formata a duração do clipe", () => {
    expect(duracaoDoTrecho("metas")).toBe("9 s");
    expect(duracaoDoTrecho(undefined)).toBeNull();
    expect(duracaoDoTrecho("nao-existe")).toBeNull();
  });

  it("nomeia o plano visível de cada tela", () => {
    expect(planoDoTutorial(tutorialPorSlug("metas")!)).toBe("Grátis");
    expect(planoDoTutorial(tutorialPorSlug("financeiro")!)).toBe("Premium");
    expect(planoDoTutorial(tutorialPorSlug("raiox")!)).toBe("Pro");
    // A tela abre em todo plano, mas conectar o canal é do Pro.
    expect(planoDoTutorial(tutorialPorSlug("anuncios")!)).toBe("Pro");
  });

  it("acha o tutorial da tela aberta pela rota mais comprida", () => {
    expect(tutorialDaRota("/produtos/anuncios/tiktok")?.slug).toBe("anuncios");
    expect(tutorialDaRota("/produtos")?.slug).toBe("produtos");
    expect(tutorialDaRota("/planejamento/modulo/2")?.slug).toBe("planejamento");
    expect(tutorialDaRota("/configuracoes/integracoes/tiktok")?.slug).toBe("anuncios");
    expect(tutorialDaRota("/configuracoes")?.slug).toBe("planos");
    expect(tutorialDaRota("/marca")?.slug).toBe("planejamento");
    expect(tutorialDaRota("/chamados")).toBeUndefined();
  });

  it("busca sem acento no texto todo", () => {
    expect(buscarTutoriais("google").map((t) => t.slug)).toContain("calendario");
    expect(buscarTutoriais("calendario").map((t) => t.slug)).toContain("calendario");
    expect(buscarTutoriais("x")).toHaveLength(TUTORIAIS.length);
  });

  it("anda pro próximo na ordem dos grupos", () => {
    expect(vizinhosDoTutorial("primeiro-acesso").anterior).toBeUndefined();
    expect(vizinhosDoTutorial("primeiro-acesso").proximo?.slug).toBe("painel");
  });

  // Regras de copy do CLAUDE.md: sem travessão, sem exclamação, sem as palavras mortas.
  it("respeita o vocabulário da marca", () => {
    const proibidas =
      /—|!|\betapa|\btrilha|\bjornada|\bmargem\b|\bsobr(a|ou|ava)\b|no seu ritmo|do seu jeito|no seu tempo|\bAimer\b|transform|revolucion/i;
    // Nomes de plano mortos: só com maiúscula, pra "um começo" passar.
    const planosMortos = /\b(Começo|Alcance|Voo|Confere|Controle|Projete)\b/;
    for (const t of TUTORIAIS) {
      for (const texto of textos(t)) {
        expect(texto, `${t.slug}: ${texto}`).not.toMatch(proibidas);
        expect(texto, `${t.slug}: ${texto}`).not.toMatch(planosMortos);
      }
    }
  });
});
