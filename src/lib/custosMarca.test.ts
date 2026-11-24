import { describe, expect, it } from "vitest";
import {
  CUSTOS_MARCA_VAZIO,
  custosDaLinha,
  mediaDePecas,
  precoNoCanal,
  rateioDaMarca,
} from "./custosMarca";

const base = { ...CUSTOS_MARCA_VAZIO, fixosMes: 334.38, proLabore: 2000, pecasMes: 120 };

describe("rateioDaMarca (ONE-258)", () => {
  it("produto divide fixos e salário pelas peças do mês", () => {
    expect(rateioDaMarca(base, true)).toBeCloseTo((334.38 + 2000) / 120, 6);
  });
  it("serviço e encomenda não levam o salário (entra pelo valor da hora)", () => {
    expect(rateioDaMarca(base, false)).toBeCloseTo(334.38 / 120, 6);
  });
  it("sem peças por mês e com custo a dividir, não chuta: null", () => {
    expect(rateioDaMarca({ ...base, pecasMes: null }, true)).toBeNull();
  });
  it("sem custo nenhum, o rateio é zero mesmo sem peças", () => {
    expect(rateioDaMarca(CUSTOS_MARCA_VAZIO, true)).toBe(0);
  });
});

describe("precoNoCanal (ONE-259)", () => {
  it("soma o acréscimo do marketplace", () => {
    expect(precoNoCanal(82.4, 40)).toBe(115.36);
  });
  it("sem acréscimo, o preço é o mesmo", () => {
    expect(precoNoCanal(82.4, 0)).toBe(82.4);
  });
  it("preço zero fica zero", () => {
    expect(precoNoCanal(0, 40)).toBe(0);
  });
});

describe("mediaDePecas", () => {
  it("arredonda a média e nunca dá menos de 1", () => {
    expect(mediaDePecas(312, 3)).toBe(104);
    expect(mediaDePecas(1, 3)).toBe(1);
  });
  it("sem venda, sem sugestão", () => {
    expect(mediaDePecas(0, 3)).toBeNull();
  });
});

describe("custosDaLinha", () => {
  it("lê números em texto do Postgres e ignora lixo", () => {
    const c = custosDaLinha(
      {
        fixos_mes: "334.38",
        fixos_detalhe: { internet: "130,00", vazio: "", numero: 3 },
        pecas_mes: 120,
        imposto_pct: "6",
        taxa_recebimento_pct: null,
        acrescimo_canais: { mercado_livre: 40, shopee: "x" },
      },
      2000,
    );
    expect(c.fixosMes).toBe(334.38);
    expect(c.fixosDetalhe).toEqual({ internet: "130,00" });
    expect(c.pecasMes).toBe(120);
    expect(c.impostoPct).toBe(6);
    expect(c.taxaRecebimentoPct).toBe(0);
    expect(c.acrescimoCanais).toEqual({ mercado_livre: 40 });
    expect(c.proLabore).toBe(2000);
  });
  it("sem linha ainda, tudo zerado", () => {
    expect(custosDaLinha(null, null)).toEqual(CUSTOS_MARCA_VAZIO);
  });
});
