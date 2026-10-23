import { describe, expect, it } from "vitest";
import {
  consumoDaProducao,
  custoDaReceita,
  insumoBaixo,
  pecasQueDaPraProduzir,
  sugestaoDaCalculadora,
  validarReceita,
  lerQuantidade,
  fmtCustoUnitario,
  fmtDia,
  fmtQtd,
  qtdNoCampo,
  type InsumoComSaldo,
} from "./producao";

const insumo = (id: string, extra: Partial<InsumoComSaldo> = {}): InsumoComSaldo => ({
  id,
  nome: id,
  unidade: "g",
  custoUnitario: 0.05,
  minimo: 0,
  saldo: 1000,
  ...extra,
});

const mapa = (...l: InsumoComSaldo[]) => new Map(l.map((i) => [i.id, i]));

describe("consumoDaProducao", () => {
  it("multiplica o uso pelas peças e diz com quanto fica", () => {
    const m = mapa(insumo("cera", { saldo: 500 }), insumo("pavio", { unidade: "un", saldo: 3 }));
    expect(
      consumoDaProducao(
        [
          { insumoId: "cera", quantidade: 150 },
          { insumoId: "pavio", quantidade: 1 },
        ],
        4,
        m,
      ),
    ).toEqual([
      { insumoId: "cera", nome: "cera", unidade: "g", usa: 600, tem: 500, fica: -100 },
      { insumoId: "pavio", nome: "pavio", unidade: "un", usa: 4, tem: 3, fica: -1 },
    ]);
  });
  it("arredonda fração como o banco e ignora peça inválida", () => {
    const m = mapa(insumo("fita", { unidade: "m", saldo: 1 }));
    expect(consumoDaProducao([{ insumoId: "fita", quantidade: 0.1 }], 3, m)[0].fica).toBe(0.7);
    expect(consumoDaProducao([{ insumoId: "fita", quantidade: 0.1 }], 0, m)).toEqual([]);
  });
});

describe("pecasQueDaPraProduzir", () => {
  it("é o menor saldo dividido pelo uso, sem erro de ponto flutuante", () => {
    const m = mapa(insumo("cera", { saldo: 1000 }), insumo("fita", { saldo: 0.3 }));
    expect(
      pecasQueDaPraProduzir(
        [
          { insumoId: "cera", quantidade: 150 },
          { insumoId: "fita", quantidade: 0.1 },
        ],
        m,
      ),
    ).toBe(3);
  });
  it("saldo negativo conta como zero e receita vazia não tem limite", () => {
    const m = mapa(insumo("cera", { saldo: -20 }));
    expect(pecasQueDaPraProduzir([{ insumoId: "cera", quantidade: 10 }], m)).toBe(0);
    expect(pecasQueDaPraProduzir([], m)).toBeNull();
  });
});

describe("custoDaReceita", () => {
  it("soma uso x custo, e some se algum insumo não tem custo", () => {
    const m = mapa(
      insumo("cera"),
      insumo("pavio", { custoUnitario: 0.3 }),
      insumo("lata", { custoUnitario: null }),
    );
    expect(
      custoDaReceita(
        [
          { insumoId: "cera", quantidade: 150 },
          { insumoId: "pavio", quantidade: 1 },
        ],
        m,
      ),
    ).toBe(7.8);
    expect(custoDaReceita([{ insumoId: "lata", quantidade: 1 }], m)).toBeNull();
    expect(custoDaReceita([], m)).toBeNull();
  });
});

describe("validarReceita e insumoBaixo", () => {
  it("pega linha sem insumo, quantidade e repetição", () => {
    expect(validarReceita([{ insumoId: "", quantidade: 1 }])).toBe("sem_insumo");
    expect(validarReceita([{ insumoId: "a", quantidade: 0 }])).toBe("quantidade");
    expect(
      validarReceita([
        { insumoId: "a", quantidade: 1 },
        { insumoId: "a", quantidade: 2 },
      ]),
    ).toBe("repetido");
    expect(validarReceita([{ insumoId: "a", quantidade: 0.5 }])).toBeNull();
  });
  it("sem mínimo cadastrado nunca está baixo", () => {
    expect(insumoBaixo({ saldo: 0, minimo: 0 })).toBe(false);
    expect(insumoBaixo({ saldo: 100, minimo: 100 })).toBe(true);
  });
});

describe("sugestaoDaCalculadora", () => {
  it("lê matéria-prima e embalagem, junta nome repetido e calcula o custo por unidade", () => {
    const breakdown = {
      valores: {
        itensMateriaPrima: JSON.stringify([
          { id: "1", nome: "Cera de soja", pago: "50", rende: "1000", unidade: "g", uso: "150" },
          { id: "2", nome: "", pago: "10", rende: "1", unidade: "", uso: "1" },
          { id: "3", nome: "cera de soja", pago: "50", rende: "1000", unidade: "g", uso: "10" },
        ]),
        itensEmbalagem: JSON.stringify([
          { id: "4", nome: "Lata", pago: "", rende: "", unidade: "", uso: "" },
        ]),
      },
    };
    expect(sugestaoDaCalculadora(breakdown)).toEqual([
      { nome: "Cera de soja", unidade: "g", custoUnitario: 0.05, quantidade: 160 },
      { nome: "Lata", unidade: "un", custoUnitario: null, quantidade: 1 },
    ]);
  });
  it("aguenta cálculo sem detalhe e JSON quebrado", () => {
    expect(sugestaoDaCalculadora(null)).toEqual([]);
    expect(sugestaoDaCalculadora({ valores: { itensMateriaPrima: "{quebrado" } })).toEqual([]);
  });
});

describe("lerQuantidade e formatos", () => {
  it("entende vírgula, milhar e ponto, e recusa texto", () => {
    expect(lerQuantidade("0,05")).toBe(0.05);
    expect(lerQuantidade("1.000,5")).toBe(1000.5);
    expect(lerQuantidade("2.5")).toBe(2.5);
    expect(lerQuantidade("1.000")).toBe(1000);
    expect(lerQuantidade("12.500")).toBe(12500);
    expect(lerQuantidade(qtdNoCampo(1000.5))).toBe(1000.5);
    expect(lerQuantidade(qtdNoCampo(0.05))).toBe(0.05);
    expect(lerQuantidade(" 150 ")).toBe(150);
    expect(lerQuantidade("")).toBeNaN();
    expect(lerQuantidade("abc")).toBeNaN();
  });
  it("custo com até 4 casas e dia sem fuso", () => {
    expect(fmtCustoUnitario(0.0035)).toBe("R$ 0,0035");
    expect(fmtCustoUnitario(2)).toBe("R$ 2,00");
    expect(fmtDia("2026-10-01")).toBe("01/10/2026");
    expect(fmtQtd(-0)).toBe("0");
    expect(fmtQtd(1500)).toBe("1.500");
  });
});
