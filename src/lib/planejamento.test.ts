import { describe, it, expect } from "vitest";
import {
  MODULOS,
  SECOES,
  FERRAMENTAS,
  CAMPO_LABEL,
  CAMPOS_FERRAMENTA,
  TOTAL_MODULOS,
  moduloInfo,
  secoesDoModulo,
  secaoPorId,
  ferramentaDe,
} from "./planejamento";

describe("moduloInfo", () => {
  it("retorna o módulo correspondente ao número pedido", () => {
    expect(moduloInfo(1)).toEqual(MODULOS[0]);
    expect(moduloInfo(6)).toEqual(MODULOS[5]);
  });

  it("trava no módulo 1 quando o número é menor que o mínimo (0 ou negativo)", () => {
    expect(moduloInfo(0)).toEqual(MODULOS[0]);
    expect(moduloInfo(-5)).toEqual(MODULOS[0]);
  });

  it("trava no último módulo quando o número excede o total", () => {
    expect(moduloInfo(999)).toEqual(MODULOS[TOTAL_MODULOS - 1]);
  });
});

describe("secoesDoModulo", () => {
  it("retorna somente as seções pertencentes ao módulo pedido", () => {
    const secoes = secoesDoModulo(1);
    expect(secoes.length).toBeGreaterThan(0);
    expect(secoes.every((s) => s.modulo === 1)).toBe(true);
  });

  it("retorna array vazio pra um módulo inexistente", () => {
    expect(secoesDoModulo(99)).toEqual([]);
  });
});

describe("secaoPorId", () => {
  it("encontra a seção pelo id exato", () => {
    expect(secaoPorId("1.1")?.titulo).toBe("Propósito");
  });

  it("retorna undefined pra um id que não existe", () => {
    expect(secaoPorId("9.9")).toBeUndefined();
  });
});

describe("ferramentaDe", () => {
  it("retorna a ferramenta correspondente ao módulo", () => {
    expect(ferramentaDe(4)).toEqual(FERRAMENTAS[4]);
  });

  it("trava na ferramenta 1 quando o número é menor que o mínimo", () => {
    expect(ferramentaDe(0)).toEqual(FERRAMENTAS[1]);
  });

  it("trava na última ferramenta quando o número excede o total", () => {
    expect(ferramentaDe(999)).toEqual(FERRAMENTAS[TOTAL_MODULOS]);
  });
});

describe("integridade dos dados estáticos (regressão contra edição manual)", () => {
  it("toda pergunta de SECOES tem um campo com rótulo em CAMPO_LABEL", () => {
    const camposSemRotulo = SECOES.flatMap((s) => s.perguntas)
      .map((p) => p.campo)
      .filter((campo) => !(campo in CAMPO_LABEL));
    expect(camposSemRotulo).toEqual([]);
  });

  it("todo campo listado em CAMPOS_FERRAMENTA existe em CAMPO_LABEL", () => {
    const camposSemRotulo = Object.values(CAMPOS_FERRAMENTA)
      .flat()
      .filter((campo) => !(campo in CAMPO_LABEL));
    expect(camposSemRotulo).toEqual([]);
  });

  it("nenhum rótulo de campo contém ponto, underline ou chave (regra explícita do comentário-fonte)", () => {
    const invalidos = Object.values(CAMPO_LABEL).filter((label) => /[._{}]/.test(label));
    expect(invalidos).toEqual([]);
  });

  it("todas as 6 rotas de ferramenta declaradas em FERRAMENTAS aparecem em CAMPOS_FERRAMENTA", () => {
    const rotas = Object.values(FERRAMENTAS).map((f) => f.rota);
    for (const rota of rotas) {
      expect(CAMPOS_FERRAMENTA).toHaveProperty(rota);
    }
  });

  it("nenhum id de seção se repete (id é chave persistida em planejamento_secoes)", () => {
    const ids = SECOES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("o prefixo do id da seção bate com o número do módulo (CamposDoc deriva o módulo daí)", () => {
    const fora = SECOES.filter((s) => Number(s.id.split(".")[0]) !== s.modulo).map((s) => s.id);
    expect(fora).toEqual([]);
  });

  it("nenhum campo é perguntado em dois módulos diferentes (a resposta é combinada por campo)", () => {
    const modulosPorCampo = new Map<string, Set<number>>();
    for (const s of SECOES) {
      for (const p of s.perguntas) {
        const set = modulosPorCampo.get(p.campo) ?? new Set<number>();
        set.add(s.modulo);
        modulosPorCampo.set(p.campo, set);
      }
    }
    const espalhados = [...modulosPorCampo.entries()]
      .filter(([, mods]) => mods.size > 1)
      .map(([campo]) => campo);
    expect(espalhados).toEqual([]);
  });
});

// EST-01 (2026-09-03): o eixo do produto é número-primeiro. Antes desta trava o
// Planejamento pedia 39 perguntas de marca, cliente e produto até a 1ª de
// dinheiro. Se alguém reordenar SECOES e empurrar a conta pra trás de novo,
// estes testes falham antes do deploy.
describe("abertura pelo dinheiro (EST-01)", () => {
  const FINANCEIRO = /^financeiro\./;

  it("a primeira seção do Planejamento é a do módulo 1 e é sobre dinheiro", () => {
    const primeira = SECOES[0];
    expect(primeira.modulo).toBe(1);
    expect(secoesDoModulo(1)[0].id).toBe(primeira.id);
    expect(primeira.perguntas.every((p) => FINANCEIRO.test(p.campo))).toBe(true);
  });

  it("a primeiríssima pergunta é um campo financeiro, não de marca nem de discurso", () => {
    expect(SECOES[0].perguntas[0].campo).toMatch(FINANCEIRO);
  });

  it("nenhuma pergunta de discurso vem antes da 1ª de dinheiro", () => {
    const todas = SECOES.flatMap((s) => s.perguntas);
    const primeiraDeDinheiro = todas.findIndex((p) => FINANCEIRO.test(p.campo));
    expect(primeiraDeDinheiro).toBe(0);
  });
});
