import { describe, expect, it } from "vitest";
import { PERGUNTAS, TERRITORIOS, type AlternativaId } from "./perguntas";
import {
  calcularResultado,
  faixaPorPontos,
  respostasCompletas,
  sanitizarRespostas,
  somarPontos,
  territorioMaisFraco,
  type RespostasQuiz,
} from "./pontuacao";

/** Todas as 8 na mesma alternativa, com as exceções aplicadas por cima. */
function respostas(padrao: AlternativaId, excecoes: RespostasQuiz = {}): RespostasQuiz {
  const base: RespostasQuiz = {};
  for (const p of PERGUNTAS) base[p.id] = padrao;
  return { ...base, ...excecoes };
}

describe("pontuação", () => {
  it("tudo A dá 16 pontos e a faixa mais alta", () => {
    const r = calcularResultado(respostas("a"));
    expect(r.pontos).toBe(16);
    expect(r.faixa.nome).toBe("Quase lá, falta amarrar");
  });

  it("tudo B dá 8 pontos", () => {
    expect(somarPontos(respostas("b"))).toBe(8);
  });

  it("tudo C dá 0 pontos e a faixa mais baixa", () => {
    const r = calcularResultado(respostas("c"));
    expect(r.pontos).toBe(0);
    expect(r.faixa.nome).toBe("No chute total");
  });

  it("pergunta sem resposta vale 0", () => {
    const parcial = respostas("a");
    delete parcial.q3;
    expect(somarPontos(parcial)).toBe(14);
  });

  it("escolha inexistente vale 0", () => {
    const forjada = respostas("a", { q3: "z" as AlternativaId });
    expect(somarPontos(forjada)).toBe(14);
  });
});

describe("faixas", () => {
  const esperado: Array<[number, string]> = [
    [16, "Quase lá, falta amarrar"],
    [13, "Quase lá, falta amarrar"],
    [12, "Meio caminho"],
    [9, "Meio caminho"],
    [8, "No escuro nos pontos que doem"],
    [5, "No escuro nos pontos que doem"],
    [4, "No chute total"],
    [0, "No chute total"],
  ];

  it.each(esperado)("%i pontos cai em %s", (pontos, nome) => {
    expect(faixaPorPontos(pontos).nome).toBe(nome);
  });

  it("cobre os 17 resultados possíveis sem buraco", () => {
    for (let p = 0; p <= 16; p++) {
      expect(faixaPorPontos(p)).toBeDefined();
    }
  });
});

describe("território mais fraco", () => {
  it("aponta o único território fraco", () => {
    // q6 = Onde você vai
    expect(territorioMaisFraco(respostas("a", { q6: "c" })).nome).toBe("Onde você vai");
    // q2 = O que você vende
    expect(territorioMaisFraco(respostas("a", { q2: "c" })).nome).toBe("O que você vende");
  });

  it("empate geral (tudo A) fica com o primeiro módulo", () => {
    expect(territorioMaisFraco(respostas("a")).nome).toBe("Razão de existir");
  });

  it("empate geral (tudo C) fica com o primeiro módulo", () => {
    expect(territorioMaisFraco(respostas("c")).nome).toBe("Razão de existir");
  });

  it("empate entre dois fica com quem vem antes na ordem dos módulos", () => {
    // Quanto vale (q1, módulo 4) x Como te acharem (q5, módulo 5)
    expect(territorioMaisFraco(respostas("a", { q1: "c", q5: "c" })).nome).toBe("Quanto vale");
    // Quem você serve (q4, módulo 2) x O que você vende (q2, módulo 3)
    expect(territorioMaisFraco(respostas("a", { q2: "c", q4: "c" })).nome).toBe("Quem você serve");
    // Onde você vai (q6, módulo 6) x Razão de existir (q3, módulo 1)
    expect(territorioMaisFraco(respostas("a", { q3: "c", q6: "c" })).nome).toBe("Razão de existir");
  });

  it("o menor ganha mesmo com outro empatado logo acima", () => {
    // razão em B (1 ponto) e onde em C (0): vence o menor, não o primeiro.
    expect(territorioMaisFraco(respostas("a", { q3: "b", q6: "c" })).nome).toBe("Onde você vai");
  });

  it("comportamento (q7 e q8) não decide território", () => {
    const r = calcularResultado(respostas("a", { q7: "c", q8: "c" }));
    expect(r.pontos).toBe(12);
    expect(r.territorioFraco.nome).toBe("Razão de existir");
  });

  it("cada um dos 6 territórios é alcançável", () => {
    const porTerritorio = PERGUNTAS.filter((p) => p.territorio);
    for (const pergunta of porTerritorio) {
      const alvo = TERRITORIOS.find((t) => t.id === pergunta.territorio)!;
      expect(territorioMaisFraco(respostas("a", { [pergunta.id]: "c" })).id).toBe(alvo.id);
    }
    expect(porTerritorio).toHaveLength(6);
  });
});

describe("saneamento do payload", () => {
  it("aceita só perguntas e alternativas conhecidas", () => {
    const limpo = sanitizarRespostas({
      q1: "a",
      q2: "z",
      q9: "a",
      q3: 7,
      q4: "b",
    });
    expect(limpo).toEqual({ q1: "a", q4: "b" });
  });

  it("reconhece resposta completa e incompleta", () => {
    expect(respostasCompletas(respostas("a"))).toBe(true);
    const parcial = respostas("a");
    delete parcial.q8;
    expect(respostasCompletas(parcial)).toBe(false);
    expect(respostasCompletas(respostas("a", { q1: "z" as AlternativaId }))).toBe(false);
  });
});

describe("conteúdo do questionário", () => {
  it("tem 8 perguntas com 3 alternativas valendo 2/1/0", () => {
    expect(PERGUNTAS).toHaveLength(8);
    for (const p of PERGUNTAS) {
      expect(p.alternativas.map((a) => a.pontos)).toEqual([2, 1, 0]);
    }
  });

  // A reordenação de 12/08 (PRD-ajuste-copy-quiz.md §2.2) mexeu só na posição.
  // Estes dois testes seguram as duas pontas: a ordem que a pessoa vê e o
  // vínculo pergunta/território, que é o que a pontuação usa. Enquanto o mapa
  // abaixo valer, todos os testes de território acima continuam dizendo o que
  // dizem, porque eles falam por id (q1, q6...), nunca por posição.
  it("exibe na ordem dos módulos, com as de comportamento por último", () => {
    expect(PERGUNTAS.map((p) => p.territorio)).toEqual([
      "razao",
      "quem",
      "vende",
      "vale",
      "acharem",
      "onde",
      null,
      null,
    ]);
  });

  it("o território é do conteúdo da pergunta, não da posição dela", () => {
    const porId = Object.fromEntries(PERGUNTAS.map((p) => [p.id, p.territorio]));
    expect(porId).toEqual({
      q1: "vale",
      q2: "vende",
      q3: "razao",
      q4: "quem",
      q5: "acharem",
      q6: "onde",
      q7: null,
      q8: null,
    });
  });

  it("toda conta de território encaixa depois do rótulo, em minúscula", () => {
    for (const t of TERRITORIOS) {
      expect(t.conta.length).toBeGreaterThan(0);
      expect(t.explicacao.length).toBeGreaterThan(0);
      expect(t.conta[0]).toBe(t.conta[0].toLowerCase());
    }
  });

  it("nenhum texto usa travessão", () => {
    const textos = [
      ...PERGUNTAS.flatMap((p) => [p.enunciado, ...p.alternativas.map((a) => a.rotulo)]),
      ...TERRITORIOS.flatMap((t) => [t.nome, t.explicacao, t.conta]),
    ];
    for (const texto of textos) {
      expect(texto).not.toMatch(/[—–]/);
    }
  });
});
