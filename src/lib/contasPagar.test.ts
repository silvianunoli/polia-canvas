import { describe, expect, it } from "vitest";
import {
  dataCurta,
  frasePrazo,
  ordenarContas,
  proximoVencimento,
  resumoContas,
  rotuloDoVencimento,
  situacaoDaConta,
  validarConta,
  type ContaPagar,
} from "./contasPagar";

const conta = (vencimento: string, valor: number, extra: Partial<ContaPagar> = {}): ContaPagar => ({
  id: vencimento + valor,
  descricao: "Conta",
  valor,
  vencimento,
  categoria: null,
  recorrencia: "nenhuma",
  diaRecorrencia: null,
  status: "a_pagar",
  pagoEm: null,
  ...extra,
});

describe("situacaoDaConta", () => {
  const hoje = "2026-10-23";
  it("separa atrasada, hoje, semana e depois", () => {
    expect(situacaoDaConta("2026-10-22", hoje)).toBe("atrasada");
    expect(situacaoDaConta("2026-10-23", hoje)).toBe("hoje");
    expect(situacaoDaConta("2026-10-30", hoje)).toBe("semana");
    expect(situacaoDaConta("2026-10-31", hoje)).toBe("depois");
  });
  it("atravessa a virada do ano", () => {
    expect(situacaoDaConta("2027-01-02", "2026-12-30")).toBe("semana");
  });
});

describe("rotuloDoVencimento", () => {
  const hoje = "2026-10-23";
  it("fala em dias perto de hoje e em data longe", () => {
    expect(rotuloDoVencimento("2026-10-20", hoje)).toBe("venceu há 3 dias");
    expect(rotuloDoVencimento("2026-10-22", hoje)).toBe("venceu ontem");
    expect(rotuloDoVencimento("2026-10-23", hoje)).toBe("vence hoje");
    expect(rotuloDoVencimento("2026-10-24", hoje)).toBe("vence amanhã");
    expect(rotuloDoVencimento("2026-10-28", hoje)).toBe("vence em 5 dias");
    expect(rotuloDoVencimento("2026-11-15", hoje)).toBe("vence dia 15/11");
    expect(rotuloDoVencimento("2027-01-05", hoje)).toBe("vence dia 05/01/2027");
  });
});

describe("dataCurta", () => {
  it("só mostra o ano quando não é o de hoje", () => {
    expect(dataCurta("2026-11-05", "2026-10-23")).toBe("05/11");
    expect(dataCurta("2027-01-05", "2026-10-23")).toBe("05/01/2027");
  });
});

describe("proximoVencimento", () => {
  it("passa pro mês seguinte no mesmo dia", () => {
    expect(proximoVencimento("2026-10-10")).toBe("2026-11-10");
  });
  it("vira o ano em dezembro", () => {
    expect(proximoVencimento("2026-12-10")).toBe("2027-01-10");
  });
  it("encurta no mês curto e volta pro dia original depois", () => {
    expect(proximoVencimento("2026-01-31", 31)).toBe("2026-02-28");
    expect(proximoVencimento("2026-02-28", 31)).toBe("2026-03-31");
    expect(proximoVencimento("2027-04-30", 31)).toBe("2027-05-31");
  });
  it("respeita ano bissexto", () => {
    expect(proximoVencimento("2028-01-30", 30)).toBe("2028-02-29");
  });
});

describe("resumoContas", () => {
  it("soma atrasadas e as da semana, ignora paga e as de depois", () => {
    const r = resumoContas(
      [
        conta("2026-10-20", 100.1),
        conta("2026-10-21", 50.2),
        conta("2026-10-23", 30),
        conta("2026-10-29", 19.9),
        conta("2026-11-20", 999),
        conta("2026-10-22", 500, { status: "paga", pagoEm: "2026-10-22" }),
      ],
      "2026-10-23",
    );
    expect(r.atrasadas).toEqual({ quantidade: 2, total: 150.3 });
    expect(r.semana).toEqual({ quantidade: 2, total: 49.9 });
  });
});

describe("frasePrazo", () => {
  it("separa o valor de cada grupo e some sem nada no prazo", () => {
    const vazio = { atrasadas: { quantidade: 0, total: 0 }, semana: { quantidade: 0, total: 0 } };
    expect(frasePrazo(vazio)).toBe("");
    const f = frasePrazo({
      atrasadas: { quantidade: 1, total: 100 },
      semana: { quantidade: 3, total: 300 },
    });
    expect(f).toMatch(
      /^1 atrasada \(R\$\s100,00\) · 3 vencem nos próximos 7 dias \(R\$\s300,00\)$/,
    );
  });
});

describe("ordenarContas", () => {
  it("ordena por vencimento e, no mesmo dia, pela maior", () => {
    const lista = ordenarContas([
      conta("2026-11-01", 10),
      conta("2026-10-25", 5),
      conta("2026-10-25", 80),
    ]);
    expect(lista.map((c) => [c.vencimento, c.valor])).toEqual([
      ["2026-10-25", 80],
      ["2026-10-25", 5],
      ["2026-11-01", 10],
    ]);
  });
});

describe("validarConta", () => {
  it("pede descrição, valor e vencimento", () => {
    expect(validarConta({ descricao: " ", valor: 10, vencimento: "2026-10-23" })).toBe(
      "sem_descricao",
    );
    expect(validarConta({ descricao: "Luz", valor: 0, vencimento: "2026-10-23" })).toBe(
      "sem_valor",
    );
    expect(validarConta({ descricao: "Luz", valor: 10, vencimento: "" })).toBe("sem_vencimento");
    expect(validarConta({ descricao: "Luz", valor: 1e9, vencimento: "2026-10-23" })).toBe(
      "valor_alto",
    );
    expect(validarConta({ descricao: "Luz", valor: 10, vencimento: "2026-10-23" })).toBeNull();
  });
});
