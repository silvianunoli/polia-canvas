import { describe, expect, it } from "vitest";
import { clientesSumidas, novasERecorrentes, type ComprasDoCliente } from "./recorrencia";

const compras = (
  clienteId: string,
  primeiraCompra: string,
  ultimaCompra: string,
  n = 1,
  total = 100,
): ComprasDoCliente => ({
  clienteId,
  nome: clienteId.charAt(0).toUpperCase() + clienteId.slice(1),
  primeiraCompra,
  ultimaCompra,
  compras: n,
  total,
});

describe("novasERecorrentes", () => {
  const mapa = new Map([
    ["ana", compras("ana", "2026-10-05", "2026-10-20")],
    ["bia", compras("bia", "2026-06-01", "2026-10-10", 3)],
    ["dani", compras("dani", "2026-10-01", "2026-10-01")],
  ]);
  it("separa quem comprou pela primeira vez de quem voltou", () => {
    const r = novasERecorrentes(
      [
        { clienteId: "ana", status: "recebida", total: 50 },
        { clienteId: "ana", status: "recebida", total: 30 },
        { clienteId: "bia", status: "a_receber", total: 120 },
        { clienteId: null, status: "recebida", total: 40 },
        { clienteId: "bia", status: "cancelada", total: 999 },
      ],
      mapa,
      "2026-10-01",
    );
    expect(r.novas).toEqual({ clientes: 1, total: 80 });
    expect(r.voltaram).toEqual({ clientes: 1, total: 120 });
    expect(r.semFicha).toEqual({ vendas: 1, total: 40 });
  });
  it("primeira compra no primeiro dia do período conta como nova", () => {
    const r = novasERecorrentes(
      [{ clienteId: "dani", status: "recebida", total: 10 }],
      mapa,
      "2026-10-01",
    );
    expect(r.novas.clientes).toBe(1);
  });
  it("no mês passado, quem estreou em setembro é nova em setembro", () => {
    const set = new Map([["eva", compras("eva", "2026-09-10", "2026-10-15", 2)]]);
    const r = novasERecorrentes(
      [{ clienteId: "eva", status: "recebida", total: 10 }],
      set,
      "2026-09-01",
    );
    expect(r.novas.clientes).toBe(1);
  });
  it("cliente sem resumo de compras conta como sem ficha", () => {
    const r = novasERecorrentes(
      [{ clienteId: "x", status: "recebida", total: 10 }],
      mapa,
      "2026-10-01",
    );
    expect(r.semFicha.vendas).toBe(1);
  });
});

describe("clientesSumidas", () => {
  const hoje = "2026-10-23";
  it("lista quem não compra há X dias, quem mais comprou primeiro", () => {
    const r = clientesSumidas(
      [
        compras("ana", "2026-01-01", "2026-08-01", 2, 300),
        compras("bia", "2026-01-01", "2026-10-15", 5, 900),
        compras("cris", "2026-01-01", "2026-07-01", 6, 800),
      ],
      hoje,
      60,
    );
    expect(r.map((c) => c.nome)).toEqual(["Cris", "Ana"]);
    expect(r[0]).toMatchObject({ diasSemComprar: 114, compras: 6, total: 800 });
  });
  it("o corte é inclusivo e quem comprou ontem não entra", () => {
    const r = clientesSumidas(
      [compras("ana", "2026-01-01", "2026-08-24"), compras("bia", "2026-10-22", "2026-10-22")],
      hoje,
      60,
    );
    expect(r.map((c) => c.nome)).toEqual(["Ana"]);
    expect(r[0].diasSemComprar).toBe(60);
  });
});
