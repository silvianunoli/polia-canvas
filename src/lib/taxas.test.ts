import { describe, expect, it } from "vitest";
import {
  decidirTaxa,
  descreverRegra,
  lerNumero,
  regraEstaVazia,
  taxaDaVenda,
  validarRegra,
} from "./taxas";

describe("taxaDaVenda", () => {
  it("soma percentual do total e fixo, em centavos", () => {
    expect(taxaDaVenda(100, { percentual: 3.99, fixo: 0.5 })).toBe(4.49);
    expect(taxaDaVenda(59.9, { percentual: 4.98, fixo: 0 })).toBe(2.98);
    expect(taxaDaVenda(80, { percentual: 0, fixo: 2 })).toBe(2);
  });
  it("sem regra ou venda zerada não tem taxa", () => {
    expect(taxaDaVenda(100, null)).toBe(0);
    expect(taxaDaVenda(0, { percentual: 5, fixo: 1 })).toBe(0);
  });
  it("nunca passa do total da venda", () => {
    expect(taxaDaVenda(1, { percentual: 0, fixo: 2 })).toBe(1);
  });
  it("meio centavo arredonda pra cima, igual ao banco", () => {
    expect(taxaDaVenda(50, { percentual: 3.19, fixo: 0.5 })).toBe(2.1);
    expect(taxaDaVenda(50, { percentual: 3.35, fixo: 0.5 })).toBe(2.18);
    expect(taxaDaVenda(470, { percentual: 3.35, fixo: 0.5 })).toBe(16.25);
  });
});

describe("decidirTaxa", () => {
  const base = {
    forma: "credito",
    regra: { percentual: 4, fixo: 0 },
    regrasCarregadas: true,
    digitadaPorEla: false,
    taxaEraAutomatica: false,
    total: 100,
  };
  it("preenche pela regra da forma", () => {
    expect(decidirTaxa(base)).toBe(4);
  });
  it("não mexe no que ela digitou", () => {
    expect(decidirTaxa({ ...base, digitadaPorEla: true })).toBeNull();
  });
  it("forma sem taxa cadastrada mantém a digitada e limpa a automática", () => {
    expect(decidirTaxa({ ...base, regra: undefined })).toBeNull();
    expect(decidirTaxa({ ...base, regra: undefined, taxaEraAutomatica: true })).toBe(0);
  });
  it("voltar pra Não informar limpa só a automática", () => {
    expect(decidirTaxa({ ...base, forma: "", taxaEraAutomatica: true })).toBe(0);
    expect(decidirTaxa({ ...base, forma: "" })).toBeNull();
  });
  it("com as regras carregando ou com erro, não escreve", () => {
    expect(decidirTaxa({ ...base, regrasCarregadas: false, taxaEraAutomatica: true })).toBeNull();
  });
});

describe("descreverRegra", () => {
  it("mostra só o que a regra tem", () => {
    expect(descreverRegra({ percentual: 3.99, fixo: 0.5 })).toMatch(/^3,99% \+ R\$\s0,50$/);
    expect(descreverRegra({ percentual: 4.5, fixo: 0 })).toBe("4,5%");
    expect(descreverRegra({ percentual: 0, fixo: 2 })).toMatch(/^R\$\s2,00$/);
    expect(descreverRegra({ percentual: 0, fixo: 0 })).toBe("sem taxa");
    expect(descreverRegra(undefined)).toBe("sem taxa");
  });
});

describe("regraEstaVazia", () => {
  it("vazia sem regra ou com tudo zero", () => {
    expect(regraEstaVazia(null)).toBe(true);
    expect(regraEstaVazia({ percentual: 0, fixo: 0 })).toBe(true);
    expect(regraEstaVazia({ percentual: 1, fixo: 0 })).toBe(false);
  });
});

describe("validarRegra", () => {
  it("percentual de 0 a 100 e fixo não negativo", () => {
    expect(validarRegra({ percentual: 101, fixo: 0 })).toBe("percentual_invalido");
    expect(validarRegra({ percentual: Number.NaN, fixo: 0 })).toBe("percentual_invalido");
    expect(validarRegra({ percentual: 2, fixo: -1 })).toBe("fixo_invalido");
    expect(validarRegra({ percentual: 2, fixo: 0.4 })).toBeNull();
    expect(validarRegra({ percentual: 4.989, fixo: 0 })).toBe("percentual_invalido");
    expect(validarRegra({ percentual: 4.99, fixo: 0.555 })).toBe("fixo_invalido");
  });
});

describe("lerNumero", () => {
  it("aceita vírgula ou ponto, vazio é zero, lixo é NaN", () => {
    expect(lerNumero("3,99")).toBe(3.99);
    expect(lerNumero("3.99")).toBe(3.99);
    expect(lerNumero(" 1.234,5 ")).toBe(1234.5);
    expect(lerNumero("")).toBe(0);
    expect(lerNumero("3,")).toBe(3);
    expect(lerNumero("abc")).toBeNaN();
    expect(lerNumero("-2")).toBeNaN();
  });
});
