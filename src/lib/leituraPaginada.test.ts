import { describe, expect, it, vi } from "vitest";
import { intervaloDoMes, LeituraIncompletaError, lerTodasAsPaginas } from "./leituraPaginada";

/** Simula o PostgREST: devolve no máximo `teto` linhas por chamada de range. */
function fonte(total: number, teto = 1000) {
  const linhas = Array.from({ length: total }, (_, i) => i);
  return vi.fn(async (de: number, ate: number) => ({
    data: linhas.slice(de, Math.min(ate + 1, de + teto)),
    error: null,
  }));
}

describe("lerTodasAsPaginas", () => {
  it("menos de uma página: uma chamada só", async () => {
    const f = fonte(10);
    expect(await lerTodasAsPaginas(f)).toHaveLength(10);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(0, 999);
  });

  it("acima de 1.000 lê tudo (o caso do QA-24)", async () => {
    const f = fonte(2345);
    const r = await lerTodasAsPaginas(f);
    expect(r).toHaveLength(2345);
    expect(r[1000]).toBe(1000);
    expect(r[2344]).toBe(2344);
    expect(f).toHaveBeenCalledTimes(3);
    expect(f).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("exatamente 1.000: confere a página seguinte vazia e para", async () => {
    const f = fonte(1000);
    expect(await lerTodasAsPaginas(f)).toHaveLength(1000);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("data null conta como página vazia", async () => {
    const r = await lerTodasAsPaginas(async () => ({ data: null, error: null }));
    expect(r).toEqual([]);
  });

  it("erro em qualquer página derruba a leitura inteira (nada de soma parcial)", async () => {
    const erro = { message: "timeout" };
    let n = 0;
    const f = async () =>
      n++ === 0 ? { data: Array(1000).fill(1), error: null } : { data: null, error: erro };
    await expect(lerTodasAsPaginas(f)).rejects.toBe(erro);
  });

  it("passou do teto de páginas: falha em vez de devolver parcial", async () => {
    const f = fonte(50, 10);
    await expect(lerTodasAsPaginas(f, 10, 3)).rejects.toBeInstanceOf(LeituraIncompletaError);
  });
});

describe("intervaloDoMes", () => {
  it("mês comum", () => {
    expect(intervaloDoMes(2026, 10)).toEqual({ inicio: "2026-10-01", fimExclusivo: "2026-11-01" });
  });
  it("dezembro vira o ano", () => {
    expect(intervaloDoMes(2026, 12)).toEqual({ inicio: "2026-12-01", fimExclusivo: "2027-01-01" });
  });
  it("janeiro com zero à esquerda", () => {
    expect(intervaloDoMes(2027, 1)).toEqual({ inicio: "2027-01-01", fimExclusivo: "2027-02-01" });
  });
});
