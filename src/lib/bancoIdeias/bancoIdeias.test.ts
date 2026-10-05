import { describe, expect, it } from "vitest";

import { MAX_NICHOS, NICHOS, montarAnoDoBanco } from "./index";

describe("montarAnoDoBanco", () => {
  it("monta um dia por dia do ano, inclusive bissexto", () => {
    expect(montarAnoDoBanco(2026, ["papelaria"])).toHaveLength(365);
    expect(montarAnoDoBanco(2028, ["papelaria"])).toHaveLength(366);
    const ano = montarAnoDoBanco(2026, ["papelaria"]);
    expect(ano[0].data).toBe("2026-01-01");
    expect(ano[364].data).toBe("2026-12-31");
  });

  it("segue a ordem do nicho e volta deslocada ao fim da lista", () => {
    const n = NICHOS[0];
    const ano = montarAnoDoBanco(2026, [n.chave]);
    expect(ano[0].titulo).toBe(n.ideias[0].titulo);
    expect(ano[1].titulo).toBe(n.ideias[1].titulo);
    expect(ano[60].titulo).toBe(n.ideias[7].titulo);
  });

  it("é determinístico e ignora nicho desconhecido", () => {
    expect(montarAnoDoBanco(2026, ["moda"])).toEqual(montarAnoDoBanco(2026, ["moda"]));
    expect(montarAnoDoBanco(2026, ["inexistente"])).toEqual([]);
  });

  it("usa um nicho só, mesmo que venham mais", () => {
    expect(MAX_NICHOS).toBe(1);
    expect(montarAnoDoBanco(2026, ["papelaria", "moda"])).toEqual(
      montarAnoDoBanco(2026, ["papelaria"]),
    );
  });
});

describe("qualidade do banco de ideias", () => {
  const PROIBIDAS =
    /\b(etapa|trilha|jornada|marco|território|bússola|infoproduto|turma|aimer|dani|poderosa|girlboss|empoderada|transforme|revolucione|viraliz\w*|imperdível|margem)\b|no seu ritmo|no seu tempo|do seu jeito/i;

  for (const nicho of NICHOS) {
    describe(nicho.nome, () => {
      it("tem 60 ideias", () => {
        expect(nicho.ideias).toHaveLength(60);
      });

      it("respeita os limites de tamanho", () => {
        for (const i of nicho.ideias) {
          expect(i.titulo.length, i.titulo).toBeLessThanOrEqual(60);
          expect(i.ideia.length, i.ideia).toBeLessThanOrEqual(220);
        }
      });

      it("não usa vocabulário proibido pela marca", () => {
        for (const i of nicho.ideias) {
          expect(`${i.titulo} ${i.ideia}`, i.titulo).not.toMatch(PROIBIDAS);
        }
      });

      it("não repete a mesma categoria em dias seguidos", () => {
        for (let k = 1; k < nicho.ideias.length; k++) {
          expect(nicho.ideias[k].categoria, nicho.ideias[k].titulo).not.toBe(
            nicho.ideias[k - 1].categoria,
          );
        }
      });

      it("não tem título repetido", () => {
        const titulos = nicho.ideias.map((i) => i.titulo);
        expect(new Set(titulos).size).toBe(titulos.length);
      });
    });
  }
});
