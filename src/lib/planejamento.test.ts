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
});
