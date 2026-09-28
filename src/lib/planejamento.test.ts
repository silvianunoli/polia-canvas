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

  // O id é chave persistida e não se renumera: "1.0" mudou pro módulo 4 em
  // 28/09/2026 mantendo o id. Por isso ninguém deriva o módulo do prefixo
  // (CamposDoc lê secaoPorId(id).modulo). Qualquer outra divergência é erro.
  it("o prefixo do id bate com o módulo, exceto a chave legada 1.0", () => {
    const fora = SECOES.filter((s) => Number(s.id.split(".")[0]) !== s.modulo).map((s) => s.id);
    expect(fora).toEqual(["1.0"]);
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

// Marca primeiro, número depois (decisão da Sil, 28/09/2026, revertendo o
// EST-01 de 03/09): módulos 1 a 3 são marca, cliente e produto; o dinheiro
// abre o módulo 4. Se alguém puxar a conta do mês pra frente de novo, estes
// testes falham antes do deploy.
describe("marca antes do dinheiro", () => {
  const FINANCEIRO = /^financeiro\./;

  it("nenhuma pergunta financeira aparece nos módulos 1 a 3", () => {
    const antes = SECOES.filter((s) => s.modulo < 4).flatMap((s) => s.perguntas);
    expect(antes.length).toBeGreaterThan(0);
    expect(antes.filter((p) => FINANCEIRO.test(p.campo))).toEqual([]);
  });

  it("a conta do mês (id 1.0, chave persistida) abre o módulo 4", () => {
    const conta = secaoPorId("1.0");
    expect(conta?.modulo).toBe(4);
    expect(secoesDoModulo(4)[0].id).toBe("1.0");
  });

  it("a ordem do array bate com a ordem dos módulos (nenhuma seção fora do lugar)", () => {
    const modulos = SECOES.map((s) => s.modulo);
    expect(modulos).toEqual([...modulos].sort((a, b) => a - b));
  });
});
