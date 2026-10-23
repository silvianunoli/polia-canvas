import { describe, expect, it } from "vitest";
import { curvaABC, produtosParados, type EntradaParado } from "./desempenho";
import type { LinhaRanking } from "./vendas";

const linha = (chave: string, entrou: number, lucrou: number | null): LinhaRanking => ({
  chave,
  produtoNome: chave,
  unidades: 1,
  entrou,
  lucrou,
});

describe("curvaABC", () => {
  it("separa pelo lucro quando todo produto tem custo", () => {
    const c = curvaABC([
      linha("a", 500, 70),
      linha("b", 100, 15),
      linha("c", 100, 10),
      linha("d", 100, 5),
      linha("e", 50, -3),
    ]);
    // Lucros 70, 15, 10, 5 (total 100): "b" cruza os 80% e fica em A.
    expect(c.base).toBe("lucrou");
    expect(c.classes.get("a")).toBe("A");
    expect(c.classes.get("b")).toBe("A");
    expect(c.classes.get("c")).toBe("B");
    expect(c.classes.get("d")).toBe("C");
    expect(c.classes.get("e")).toBe("C");
    expect(c.resumo.A.produtos).toBe(2);
    expect(c.resumo.A.parte).toBeCloseTo(0.85);
  });
  it("cai pro que vendeu quando falta custo, e diz em quem", () => {
    const c = curvaABC([linha("a", 900, 100), linha("b", 100, null)]);
    expect(c.base).toBe("entrou");
    expect(c.semCusto).toEqual(["b"]);
    expect(c.classes.get("a")).toBe("A");
    expect(c.classes.get("b")).toBe("B");
  });
  it("valores iguais ficam na mesma classe, em qualquer ordem de entrada", () => {
    const entrada = [linha("a", 0, 70), linha("x", 0, 10), linha("y", 0, 10), linha("z", 0, 10)];
    const c1 = curvaABC(entrada);
    const c2 = curvaABC([...entrada].reverse());
    expect(["x", "y", "z"].map((k) => c1.classes.get(k))).toEqual(["A", "A", "A"]);
    expect(["x", "y", "z"].map((k) => c2.classes.get(k))).toEqual(["A", "A", "A"]);
  });
  it("um produto só é A; tudo no prejuízo é C", () => {
    expect(curvaABC([linha("a", 10, 5)]).classes.get("a")).toBe("A");
    const c = curvaABC([linha("a", 10, -1), linha("b", 10, 0)]);
    expect([c.classes.get("a"), c.classes.get("b")]).toEqual(["C", "C"]);
    expect(c.resumo.A.produtos).toBe(0);
  });
  it("vazio não quebra", () => {
    expect(curvaABC([]).classes.size).toBe(0);
  });
});

describe("produtosParados", () => {
  const hoje = "2026-10-23";
  const p = (id: string, extra: Partial<EntradaParado> = {}): EntradaParado => ({
    id,
    nome: id,
    tipo: "produto",
    precoCusto: 10,
    controlaEstoque: true,
    criadoEm: "2026-01-10T12:00:00Z",
    saldos: [5],
    ...extra,
  });

  it("pega quem não vende há X dias e soma o dinheiro parado", () => {
    const r = produtosParados(
      [p("vendeu"), p("parado"), p("nunca", { saldos: [2] })],
      new Map([
        ["vendeu", "2026-10-20"],
        ["parado", "2026-08-01"],
      ]),
      hoje,
      30,
    );
    expect(r.map((x) => x.id)).toEqual(["parado", "nunca"]);
    expect(r[0]).toMatchObject({ diasSemVenda: 83, dinheiroParado: 50 });
    expect(r[1]).toMatchObject({ ultimaVenda: null, cadastradoHa: 286, dinheiroParado: 20 });
  });
  it("recém-cadastrado sem venda não é parado", () => {
    const r = produtosParados(
      [p("novo", { criadoEm: "2026-10-18T09:00:00Z" })],
      new Map(),
      hoje,
      30,
    );
    expect(r).toEqual([]);
  });
  it("ignora serviço, produto digital e estoque zerado", () => {
    const r = produtosParados(
      [p("serv", { tipo: "servico" }), p("dig", { tipo: "digital" }), p("zerado", { saldos: [0] })],
      new Map(),
      hoje,
      30,
    );
    expect(r).toEqual([]);
  });
  it("variação negativa não abate a positiva", () => {
    const [r] = produtosParados([p("x", { saldos: [-3, 20] })], new Map(), hoje, 30);
    expect(r).toMatchObject({ saldo: 20, dinheiroParado: 200 });
  });
  it("estoque ligado sem custo e estoque desligado ficam sem valor, cada um marcado", () => {
    const r = produtosParados(
      [p("semcusto", { precoCusto: null }), p("desligado", { controlaEstoque: false, saldos: [] })],
      new Map(),
      hoje,
      30,
    );
    expect(r.find((x) => x.id === "semcusto")).toMatchObject({
      controlaEstoque: true,
      dinheiroParado: null,
      saldo: 5,
    });
    expect(r.find((x) => x.id === "desligado")).toMatchObject({
      controlaEstoque: false,
      dinheiroParado: null,
    });
  });
});
