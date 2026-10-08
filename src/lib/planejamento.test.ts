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
  moduloAtualDe,
  moduloCompleto,
  moduloLiberado,
  modulosQueFaltamAntes,
  textoModulosQueFaltam,
  acessoDaFerramenta,
} from "./planejamento";
import { hrefUpgrade } from "./planos";

const idsDosModulos = (...ns: number[]) =>
  new Set(ns.flatMap((n) => secoesDoModulo(n).map((s) => s.id)));

describe("liberação dos módulos (QA-21)", () => {
  it("sem nada concluído, só o Módulo 1 abre", () => {
    const nada = new Set<string>();
    expect(moduloAtualDe(nada)).toBe(1);
    expect(moduloLiberado(1, nada)).toBe(true);
    for (let n = 2; n <= TOTAL_MODULOS; n++) expect(moduloLiberado(n, nada)).toBe(false);
  });

  it("com os Módulos 1 e 2 fechados, abre até o 3", () => {
    const feitos = idsDosModulos(1, 2);
    expect(moduloAtualDe(feitos)).toBe(3);
    expect(moduloLiberado(1, feitos)).toBe(true);
    expect(moduloLiberado(3, feitos)).toBe(true);
    expect(moduloLiberado(4, feitos)).toBe(false);
  });

  it("módulo pela metade não libera o seguinte", () => {
    const feitos = idsDosModulos(1);
    feitos.add(secoesDoModulo(2)[0].id);
    expect(moduloCompleto(2, feitos)).toBe(false);
    expect(moduloLiberado(2, feitos)).toBe(true);
    expect(moduloLiberado(3, feitos)).toBe(false);
  });

  it("a seção 1.0 conta pro Módulo 4, não pro 1", () => {
    const feitos = idsDosModulos(1, 2, 3);
    feitos.delete("1.0");
    expect(moduloCompleto(1, feitos)).toBe(true);
    expect(moduloCompleto(4, feitos)).toBe(false);
    expect(moduloAtualDe(feitos)).toBe(4);
  });

  it("módulo já concluído continua abrindo, mesmo com um anterior reaberto", () => {
    // Seção nova num módulo antigo reabre ele; o que já estava fechado depois
    // continua editável.
    const feitos = idsDosModulos(1, 2, 3, 5);
    expect(moduloAtualDe(feitos)).toBe(4);
    expect(moduloLiberado(5, feitos)).toBe(true);
    expect(moduloLiberado(6, feitos)).toBe(false);
  });

  it("com tudo concluído, todos abrem", () => {
    const tudo = new Set(SECOES.map((s) => s.id));
    expect(moduloAtualDe(tudo)).toBe(TOTAL_MODULOS + 1);
    for (let n = 1; n <= TOTAL_MODULOS; n++) expect(moduloLiberado(n, tudo)).toBe(true);
  });

  it("lista os módulos anteriores que ainda faltam", () => {
    expect(modulosQueFaltamAntes(4, idsDosModulos(1))).toEqual([2, 3]);
    expect(modulosQueFaltamAntes(6, idsDosModulos(1, 2, 3, 5))).toEqual([4]);
    expect(modulosQueFaltamAntes(1, new Set())).toEqual([]);
  });

  it("monta o texto dos módulos que faltam", () => {
    expect(textoModulosQueFaltam([3])).toBe("o Módulo 3 estiver concluído");
    expect(textoModulosQueFaltam([2, 3])).toBe("os Módulos 2 e 3 estiverem concluídos");
    expect(textoModulosQueFaltam([2, 3, 4])).toBe("os Módulos 2, 3 e 4 estiverem concluídos");
    expect(textoModulosQueFaltam([])).toBe("");
  });
});

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

describe("hrefUpgrade", () => {
  it("leva o plano que a rota exige, não um Premium fixo", () => {
    expect(hrefUpgrade("/raiox")).toBe("/upgrade?rota=%2Fraiox&tier=projete");
    expect(hrefUpgrade("/financeiro")).toBe("/upgrade?rota=%2Ffinanceiro&tier=controle");
  });
});

describe("acessoDaFerramenta", () => {
  it("no Grátis, Marca, Mapa de Mercado e Financeiro levam pro upgrade do Premium com cadeado", () => {
    for (const n of [1, 2, 4]) {
      const f = ferramentaDe(n);
      const a = acessoDaFerramenta(f, "confere");
      expect(a.liberada).toBe(false);
      expect(a.href).toBe(hrefUpgrade(f.rota));
      expect(a.rotulo).toBe(`${f.abrirLabel} no Premium`);
      expect(a.tituloPlano).toBe("Premium");
      expect(a.aviso).not.toMatch(/[—–!]/);
    }
  });

  it("cancelada conta como Grátis", () => {
    expect(acessoDaFerramenta(ferramentaDe(4), "cancelada").liberada).toBe(false);
  });

  it("no Grátis, Catálogo, Caderno e Metas abrem direto", () => {
    for (const n of [3, 5, 6]) {
      const f = ferramentaDe(n);
      expect(acessoDaFerramenta(f, "confere")).toEqual({
        liberada: true,
        href: f.rota,
        rotulo: f.abrirLabel,
        aviso: "",
        tituloPlano: null,
      });
    }
  });

  it("Premium, Pro e beta abrem todas", () => {
    for (const plano of ["controle", "projete", "beta"]) {
      for (let n = 1; n <= TOTAL_MODULOS; n++) {
        expect(acessoDaFerramenta(ferramentaDe(n), plano).liberada).toBe(true);
      }
    }
  });

  it("enquanto o plano carrega, nada de cadeado", () => {
    expect(acessoDaFerramenta(ferramentaDe(1), "confere", true).liberada).toBe(true);
  });
});
