import { describe, it, expect } from "vitest";
import {
  PESQUISAS,
  pesquisaPorSlug,
  perguntasPorId,
  totalPerguntas,
  perguntaPorOrdem,
  type PesquisaConfig,
  type Pergunta,
} from "./registro";

// Vocabulário proibido em texto visível (CLAUDE.md, regra nº 3). "margem" só
// é liberada dentro da calculadora; em pesquisa vira "quanto sobra".
const VOCABULARIO_PROIBIDO = [
  /\betapas?\b/i,
  /\btrilhas?\b/i,
  /\bjornadas?\b/i,
  /no seu ritmo/i,
  /no seu tempo/i,
  /do seu jeito/i,
  /\binfoprodutos?\b/i,
  /\bmargem\b/i,
  /\bDani\b/,
  /\bturma\b/i,
  /planilha por fora/i,
];

function textosVisiveis(p: Pergunta): string[] {
  return [
    p.titulo,
    p.ajuda ?? "",
    p.placeholder ?? "",
    ...(p.opcoes ?? []).map((o) => o.rotulo),
  ].filter(Boolean);
}

describe("PESQUISAS (registro)", () => {
  it("lista as duas pesquisas com slugs únicos", () => {
    const slugs = PESQUISAS.map((p) => p.slug);
    expect(slugs).toEqual(["discovery-negocio", "pesquisa-precificacao"]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("slug é kebab-case (vira parte da URL pública)", () => {
    for (const p of PESQUISAS) expect(p.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

// Invariantes que valem pra QUALQUER pesquisa registrada: quebrar um deles
// quebra a página pública (ordem), a agregação no admin (ids) ou a marca (texto).
describe.each(PESQUISAS.map((p) => [p.slug, p] as [string, PesquisaConfig]))(
  "estrutura de %s",
  (_slug, config) => {
    it("ids das perguntas são únicos (são a chave em pesquisa_respostas.respostas)", () => {
      const ids = config.perguntas.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("ordem é contígua de 1 até o total, sem buraco nem repetição", () => {
      const ordens = config.perguntas.map((p) => p.ordem);
      expect(ordens).toEqual(config.perguntas.map((_, i) => i + 1));
    });

    it("toda pergunta de escolha (única/múltipla) tem pelo menos 2 opções com ids únicos", () => {
      for (const p of config.perguntas) {
        if (p.tipo === "aberta") continue;
        expect(p.opcoes, p.id).toBeDefined();
        expect(p.opcoes!.length, p.id).toBeGreaterThanOrEqual(2);
        const ids = p.opcoes!.map((o) => o.id);
        expect(new Set(ids).size, p.id).toBe(ids.length);
        for (const o of p.opcoes!)
          expect(o.rotulo.trim().length, `${p.id}/${o.id}`).toBeGreaterThan(0);
      }
    });

    it("pergunta aberta não carrega opções", () => {
      for (const p of config.perguntas) {
        if (p.tipo === "aberta") expect(p.opcoes, p.id).toBeUndefined();
      }
    });

    it("múltipla escolha declara maxSelecoes e o aviso de quantas escolher", () => {
      for (const p of config.perguntas) {
        if (p.tipo !== "multipla") continue;
        expect(p.maxSelecoes, p.id).toBeGreaterThanOrEqual(1);
        expect(p.maxSelecoes!, p.id).toBeLessThan(p.opcoes!.length);
      }
    });

    // Toda pergunta obrigatória precisa ter como ser respondida: aberta
    // obrigatória travaria quem não quer escrever.
    it("toda pergunta obrigatória é de escolha (aberta é sempre opcional)", () => {
      for (const p of config.perguntas) {
        if (!p.opcional) expect(p.tipo, p.id).not.toBe("aberta");
      }
    });

    it("dado sensível (LGPD) é sempre opcional", () => {
      for (const p of config.perguntas) {
        if (p.sensivel) expect(p.opcional, p.id).toBe(true);
      }
    });

    it("parte é 1 ou 2", () => {
      for (const p of config.perguntas) expect([1, 2]).toContain(p.parte);
    });

    it("nenhum texto visível usa vocabulário proibido da marca", () => {
      for (const p of config.perguntas) {
        for (const texto of textosVisiveis(p)) {
          for (const proibido of VOCABULARIO_PROIBIDO) {
            expect(texto, `${p.id}: "${texto}"`).not.toMatch(proibido);
          }
        }
      }
    });

    it("nenhum texto visível usa travessão, exclamação ou emoji", () => {
      for (const p of config.perguntas) {
        for (const texto of textosVisiveis(p)) {
          expect(texto, `${p.id}: "${texto}"`).not.toMatch(/[\u2014!]/);
          expect(texto, `${p.id}: "${texto}"`).not.toMatch(/\p{Extended_Pictographic}/u);
        }
      }
    });

    it("todo título termina com pontuação de pergunta ou frase (sem texto solto)", () => {
      for (const p of config.perguntas) expect(p.titulo, p.id).toMatch(/[?.]$/);
    });
  },
);

describe("helpers do registro", () => {
  const config = PESQUISAS[0];

  it("pesquisaPorSlug acha a pesquisa e devolve undefined pra slug desconhecido", () => {
    expect(pesquisaPorSlug("discovery-negocio")).toBe(config);
    expect(pesquisaPorSlug("nao-existe")).toBeUndefined();
  });

  it("perguntasPorId indexa toda pergunta pelo id", () => {
    const mapa = perguntasPorId(config);
    expect(Object.keys(mapa)).toHaveLength(config.perguntas.length);
    expect(mapa.estagio.ordem).toBe(1);
  });

  it("totalPerguntas conta as perguntas", () => {
    expect(totalPerguntas(config)).toBe(config.perguntas.length);
  });

  it("perguntaPorOrdem acha pela posição e devolve undefined fora do intervalo", () => {
    expect(perguntaPorOrdem(config, 1)?.id).toBe("estagio");
    expect(perguntaPorOrdem(config, 0)).toBeUndefined();
    expect(perguntaPorOrdem(config, config.perguntas.length + 1)).toBeUndefined();
  });
});
