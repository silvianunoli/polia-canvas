import { describe, expect, it, vi } from "vitest";
import {
  chaveDoMes,
  dataNoMesDe,
  ehEntradaDeVenda,
  limitesDoMes,
  numerosDoMes,
  somarEntradasDoMes,
} from "./numerosDoMes";

const L = (
  tipo: string,
  valor: number | string,
  data: string,
  categoria: string | null = null,
) => ({ tipo, valor, data, categoria });

describe("numerosDoMes", () => {
  it("soma só o mês pedido", () => {
    const r = numerosDoMes(
      [
        L("entrada", 100, "2026-10-01", "Venda de produto"),
        L("entrada", 44.1, "2026-10-31"),
        L("saida", 30, "2026-10-15"),
        L("entrada", 999, "2026-09-30", "Venda de produto"),
        L("saida", 999, "2026-11-01"),
      ],
      2026,
      10,
    );
    expect(r.entradas).toBeCloseTo(144.1);
    expect(r.saidas).toBe(30);
    expect(r.sobra).toBeCloseTo(114.1);
    expect(r.registrosDeEntrada).toBe(2);
    expect(r.vendas).toBe(1);
  });

  it("aceita valor em texto (numeric do Postgres) e ignora lixo", () => {
    const r = numerosDoMes(
      [L("entrada", "10.50", "2026-10-02"), L("entrada", "abc", "2026-10-02")],
      2026,
      10,
    );
    expect(r.entradas).toBeCloseTo(10.5);
    expect(r.registrosDeEntrada).toBe(1);
  });

  it("mês sem nada é tudo zero", () => {
    expect(numerosDoMes([], 2026, 1)).toEqual({
      entradas: 0,
      saidas: 0,
      sobra: 0,
      vendas: 0,
      registrosDeEntrada: 0,
    });
  });
});

describe("ehEntradaDeVenda", () => {
  it("venda de produto e prestação de serviço contam", () => {
    expect(ehEntradaDeVenda({ tipo: "entrada", categoria: "Venda de produto" })).toBe(true);
    expect(ehEntradaDeVenda({ tipo: "entrada", categoria: " Prestação de serviço " })).toBe(true);
  });

  it("sem categoria, Outros, categoria própria e saída não contam", () => {
    expect(ehEntradaDeVenda({ tipo: "entrada", categoria: null })).toBe(false);
    expect(ehEntradaDeVenda({ tipo: "entrada", categoria: "Outros" })).toBe(false);
    expect(ehEntradaDeVenda({ tipo: "entrada", categoria: "Aporte" })).toBe(false);
    expect(ehEntradaDeVenda({ tipo: "saida", categoria: "Venda de produto" })).toBe(false);
  });
});

describe("limitesDoMes / dataNoMesDe", () => {
  it("primeiro e último dia, inclusive fevereiro bissexto", () => {
    expect(limitesDoMes("2026-10-08")).toEqual({ min: "2026-10-01", max: "2026-10-31" });
    expect(limitesDoMes("2028-02-10")).toEqual({ min: "2028-02-01", max: "2028-02-29" });
    expect(limitesDoMes("2026-02-10")).toEqual({ min: "2026-02-01", max: "2026-02-28" });
  });

  it("data dentro e fora do mês", () => {
    expect(dataNoMesDe("2026-10-31", "2026-10-08")).toBe(true);
    expect(dataNoMesDe("2026-09-30", "2026-10-08")).toBe(false);
    expect(dataNoMesDe("2026-11-01", "2026-10-08")).toBe(false);
  });

  it("chaveDoMes preenche o zero", () => {
    expect(chaveDoMes(2026, 3)).toBe("2026-03");
  });
});

describe("somarEntradasDoMes", () => {
  function clienteCom(paginas: { data: unknown[] | null; error: unknown }[]) {
    const chamadas: Record<string, unknown[]> = {};
    let i = 0;
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt", "order"]) {
      q[m] = (...args: unknown[]) => {
        (chamadas[m] ??= []).push(args);
        return q;
      };
    }
    q.range = () => ({
      then: (fn: (r: unknown) => unknown) => Promise.resolve(fn(paginas[i++])),
    });
    const from = vi.fn(() => q);
    return { client: { from } as never, chamadas, from };
  }

  it("filtra entrada do mês e soma", async () => {
    const { client, chamadas, from } = clienteCom([
      { data: [{ valor: 100 }, { valor: "44.10" }], error: null },
    ]);
    const soma = await somarEntradasDoMes(client, "u1", 2026, 10);
    expect(soma).toBeCloseTo(144.1);
    expect(from).toHaveBeenCalledWith("lancamentos");
    expect(chamadas.eq).toContainEqual(["user_id", "u1"]);
    expect(chamadas.eq).toContainEqual(["tipo", "entrada"]);
    expect(chamadas.gte).toContainEqual(["data", "2026-10-01"]);
    expect(chamadas.lt).toContainEqual(["data", "2026-11-01"]);
  });

  it("erro de leitura sobe em vez de virar zero", async () => {
    const erro = new Error("falhou");
    const { client } = clienteCom([{ data: null, error: erro }]);
    await expect(somarEntradasDoMes(client, "u1", 2026, 10)).rejects.toBe(erro);
  });
});
