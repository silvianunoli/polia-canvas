import { describe, it, expect } from "vitest";
import { CONSENT_TEXTO, FAIXAS, PERGUNTAS, TERRITORIOS, TOTAL_PERGUNTAS } from "./perguntas";
import { faixaPorPontos, somarPontos, type RespostasQuiz } from "./pontuacao";

// Vocabulário proibido em texto visível (CLAUDE.md, regra nº 3). Os
// identificadores de código (TERRITORIOS, territorio) podem ficar; o que
// não pode é a palavra aparecer pra usuária.
const VOCABULARIO_PROIBIDO = [
  /\betapas?\b/i,
  /\btrilhas?\b/i,
  /\bjornadas?\b/i,
  /\bterrit[óo]rios?\b/i,
  /\bmarcos?\b/i,
  /\bb[úu]ssola\b/i,
  /no seu ritmo/i,
  /no seu tempo/i,
  /do seu jeito/i,
  /\binfoprodutos?\b/i,
  /\bmargem\b/i,
  /\bDani\b/,
  /\bturma\b/i,
];

const TEXTOS_VISIVEIS: Array<[string, string]> = [
  ...PERGUNTAS.flatMap((p) => [
    [`${p.id}.enunciado`, p.enunciado] as [string, string],
    ...p.alternativas.map((a) => [`${p.id}.${a.id}`, a.rotulo] as [string, string]),
  ]),
  ...TERRITORIOS.flatMap((t) => [
    [`${t.id}.nome`, t.nome] as [string, string],
    [`${t.id}.explicacao`, t.explicacao] as [string, string],
    [`${t.id}.conta`, t.conta] as [string, string],
  ]),
  ...FAIXAS.flatMap((f) => [
    [`${f.id}.nome`, f.nome] as [string, string],
    [`${f.id}.resumo`, f.resumo] as [string, string],
  ]),
  ["consent", CONSENT_TEXTO],
];

describe("PERGUNTAS", () => {
  it("são 8, com ids únicos q1..q8", () => {
    expect(PERGUNTAS).toHaveLength(8);
    expect(TOTAL_PERGUNTAS).toBe(8);
    expect([...PERGUNTAS.map((p) => p.id)].sort()).toEqual([
      "q1",
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
      "q7",
      "q8",
    ]);
  });

  // A régua em pontuacao.ts assume A=2, B=1, C=0 em toda pergunta: qualquer
  // desvio aqui muda faixa e módulo fraco sem ninguém perceber.
  it.each(PERGUNTAS.map((p) => [p.id, p] as const))(
    "%s tem alternativas a/b/c valendo 2/1/0",
    (_id, p) => {
      expect(p.alternativas.map((a) => a.id)).toEqual(["a", "b", "c"]);
      expect(p.alternativas.map((a) => a.pontos)).toEqual([2, 1, 0]);
      for (const a of p.alternativas) expect(a.rotulo.trim().length).toBeGreaterThan(0);
    },
  );

  it("cada um dos 6 módulos é medido por exatamente uma pergunta", () => {
    const medidos = PERGUNTAS.map((p) => p.territorio).filter(Boolean);
    expect([...medidos].sort()).toEqual([...TERRITORIOS.map((t) => t.id)].sort());
  });

  it("as 2 perguntas de comportamento (q7 e q8) não apontam módulo", () => {
    const semModulo = PERGUNTAS.filter((p) => p.territorio === null).map((p) => p.id);
    expect(semModulo.sort()).toEqual(["q7", "q8"]);
  });

  // Abrir por desconto fazia o quiz inteiro parecer calculadora de preço.
  it("a ordem de exibição abre por Razão de existir e fecha com as de comportamento", () => {
    expect(PERGUNTAS[0].territorio).toBe("razao");
    expect(PERGUNTAS.slice(0, 6).map((p) => p.territorio)).toEqual(TERRITORIOS.map((t) => t.id));
    expect(PERGUNTAS.slice(6).every((p) => p.territorio === null)).toBe(true);
  });

  it("a pontuação máxima possível (tudo A) é 16 e cai na faixa mais alta", () => {
    const tudoA: RespostasQuiz = Object.fromEntries(PERGUNTAS.map((p) => [p.id, "a"]));
    expect(somarPontos(tudoA)).toBe(16);
    expect(faixaPorPontos(16)).toBe(FAIXAS[0]);
  });
});

describe("TERRITORIOS", () => {
  it("são 6 com ids únicos, cada um com nome, explicação e conta", () => {
    expect(TERRITORIOS).toHaveLength(6);
    expect(new Set(TERRITORIOS.map((t) => t.id)).size).toBe(6);
    for (const t of TERRITORIOS) {
      expect(t.nome.trim().length).toBeGreaterThan(0);
      expect(t.explicacao.trim().length).toBeGreaterThan(0);
      expect(t.conta.trim().length).toBeGreaterThan(0);
    }
  });

  // Desde 16/09/2026 o rótulo virou heading solto ("O que fazer agora"), então
  // cada `conta` começa frase própria, com maiúscula.
  it("toda conta começa com maiúscula (é frase própria, não continuação de rótulo)", () => {
    for (const t of TERRITORIOS) expect(t.conta, t.id).toMatch(/^[A-ZÀ-Ý]/);
  });
});

describe("FAIXAS", () => {
  it("vêm da maior pra menor e a última começa em 0 (faixaPorPontos pega a primeira que couber)", () => {
    const mins = FAIXAS.map((f) => f.min);
    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect(mins[mins.length - 1]).toBe(0);
    expect(new Set(FAIXAS.map((f) => f.id)).size).toBe(FAIXAS.length);
  });

  it("todo total de 0 a 16 cai em alguma faixa", () => {
    for (let pontos = 0; pontos <= 16; pontos++) {
      expect(FAIXAS.map((f) => f.id)).toContain(faixaPorPontos(pontos).id);
    }
  });
});

describe("copy do quiz", () => {
  it("nenhum texto visível usa vocabulário proibido da marca", () => {
    for (const [onde, texto] of TEXTOS_VISIVEIS) {
      for (const proibido of VOCABULARIO_PROIBIDO) {
        expect(texto, `${onde}: "${texto}"`).not.toMatch(proibido);
      }
    }
  });

  it("nenhum texto visível usa travessão, exclamação nem emoji", () => {
    for (const [onde, texto] of TEXTOS_VISIVEIS) {
      expect(texto, `${onde}: "${texto}"`).not.toMatch(/[\u2014!]/);
      expect(texto, `${onde}: "${texto}"`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  // "você" pode observar a cena, mas não prometer resultado (trava de 17/08/2026).
  it("nenhum texto usa 'você' como promessa de capacidade ou futuro", () => {
    for (const [onde, texto] of TEXTOS_VISIVEIS) {
      expect(texto, `${onde}: "${texto}"`).not.toMatch(
        /você (consegue|merece|vai (longe|conseguir|transformar))/i,
      );
    }
  });

  // O texto de consentimento promete o diagnóstico por e-mail e vai gravado
  // em quiz_leads.consent_texto: mudar aqui muda o que a pessoa aceitou.
  it("CONSENT_TEXTO menciona e-mail, diagnóstico e a saída fácil", () => {
    expect(CONSENT_TEXTO).toMatch(/diagn[óo]stico/i);
    expect(CONSENT_TEXTO).toMatch(/e-mail/i);
    expect(CONSENT_TEXTO).toMatch(/sai quando quiser/i);
  });
});
