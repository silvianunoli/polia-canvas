import { describe, expect, it } from "vitest";
import {
  campeaoDivergente,
  diferencaDoAjuste,
  intervaloDoPeriodo,
  resumoVendas,
  contarEstoqueBaixo,
  estoqueBaixo,
  lucroDaVenda,
  maisVendidos,
  totalDaVenda,
  validarVenda,
  valorRecebidoDaVenda,
  type ItemVenda,
  type Venda,
} from "./vendas";

const item = (
  produtoId: string,
  quantidade: number,
  precoUnitario: number,
  custoUnitario: number | null = null,
): ItemVenda => ({ produtoId, produtoNome: produtoId, quantidade, precoUnitario, custoUnitario });

const venda = (itens: ItemVenda[], extra: Partial<Venda> = {}): Venda => ({
  status: "recebida",
  desconto: 0,
  taxaCanal: 0,
  itens,
  ...extra,
});

describe("total e valor recebido", () => {
  it("total soma itens, tira desconto e põe frete", () => {
    expect(totalDaVenda({ itens: [item("a", 2, 59)], desconto: 10, frete: 15 })).toBe(123);
  });

  it("valor recebido tira a taxa do canal", () => {
    expect(
      valorRecebidoDaVenda({ itens: [item("a", 2, 59)], desconto: 0, frete: 0, taxaCanal: 5.9 }),
    ).toBe(112.1);
  });

  it("não deixa resto de ponto flutuante", () => {
    expect(totalDaVenda({ itens: [item("a", 3, 0.1)], desconto: 0, frete: 0.2 })).toBe(0.5);
  });
});

describe("lucroDaVenda", () => {
  it("itens - desconto - taxa - custo, sem o frete", () => {
    const v = venda([item("a", 2, 59, 33)], { desconto: 4, taxaCanal: 2 });
    expect(lucroDaVenda(v)).toBe(118 - 4 - 2 - 66);
  });

  it("item sem custo deixa o lucro desconhecido, não zero", () => {
    expect(lucroDaVenda(venda([item("a", 1, 50, 20), item("b", 1, 30, null)]))).toBeNull();
  });

  it("prejuízo sai negativo", () => {
    expect(lucroDaVenda(venda([item("a", 1, 20, 25)]))).toBe(-5);
  });
});

describe("validarVenda", () => {
  const base = { desconto: 0, frete: 0, taxaCanal: 0 };
  it("aceita venda normal", () => {
    expect(validarVenda({ ...base, itens: [item("a", 1, 10)] })).toBeNull();
  });
  it("barra venda sem item", () => {
    expect(validarVenda({ ...base, itens: [] })).toBe("sem_itens");
  });
  it("barra quantidade zero ou quebrada", () => {
    expect(validarVenda({ ...base, itens: [item("a", 0, 10)] })).toBe("quantidade_invalida");
    expect(validarVenda({ ...base, itens: [item("a", 1.5, 10)] })).toBe("quantidade_invalida");
  });
  it("barra desconto maior que a venda", () => {
    expect(validarVenda({ ...base, desconto: 11, itens: [item("a", 1, 10)] })).toBe(
      "desconto_maior_que_venda",
    );
  });
  it("aceita item de graça (brinde)", () => {
    expect(validarVenda({ ...base, itens: [item("a", 1, 0)] })).toBeNull();
  });
});

describe("maisVendidos", () => {
  const vendas: Venda[] = [
    venda([item("sol", 10, 49, 36)]),
    venda([item("sol", 5, 49, 36)]),
    venda([item("lua", 6, 59, 33)]),
    venda([item("lua", 50, 59, 33)], { status: "cancelada" }),
  ];

  it("ignora venda cancelada", () => {
    const lua = maisVendidos(vendas).find((l) => l.chave === "lua");
    expect(lua?.unidades).toBe(6);
  });

  it("ordena por unidades", () => {
    expect(maisVendidos(vendas).map((l) => l.chave)).toEqual(["sol", "lua"]);
  });

  it("ordena por lucro", () => {
    // sol: 15 x 13 = 195; lua: 6 x 26 = 156
    expect(maisVendidos(vendas, "lucrou").map((l) => l.lucrou)).toEqual([195, 156]);
  });

  it("rateia desconto e taxa pelo valor de cada item", () => {
    const [a, b] = maisVendidos(
      [venda([item("a", 1, 75, 0), item("b", 1, 25, 0)], { desconto: 10, taxaCanal: 4 })],
      "entrou",
    );
    expect(a).toMatchObject({ chave: "a", entrou: 67.5, lucrou: 64.5 });
    expect(b).toMatchObject({ chave: "b", entrou: 22.5, lucrou: 21.5 });
  });

  it("lucro desconhecido de um produto fica null e vai pro fim no ranking de lucro", () => {
    const linhas = maisVendidos(
      [venda([item("a", 1, 10, null)]), venda([item("b", 1, 10, 2)])],
      "lucrou",
    );
    expect(linhas.map((l) => [l.chave, l.lucrou])).toEqual([
      ["b", 8],
      ["a", null],
    ]);
  });

  it("produto apagado agrupa pelo nome guardado", () => {
    const linhas = maisVendidos([
      venda([{ ...item("x", 1, 10), produtoId: null, produtoNome: "Vela" }]),
      venda([{ ...item("x", 2, 10), produtoId: null, produtoNome: "Vela" }]),
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].unidades).toBe(3);
  });
});

describe("campeaoDivergente", () => {
  it("aponta quando quem mais sai não é quem mais lucra", () => {
    const linhas = maisVendidos([
      venda([item("sol", 31, 49, 36)]),
      venda([item("lua", 18, 59, 33)]),
    ]);
    const r = campeaoDivergente(linhas);
    expect(r?.maisSai.chave).toBe("sol");
    expect(r?.maisLucra.chave).toBe("lua");
    expect(r?.diferencaUnidades).toBe(13);
  });

  it("some quando é o mesmo produto", () => {
    const linhas = maisVendidos([
      venda([item("sol", 31, 49, 10)]),
      venda([item("lua", 2, 59, 33)]),
    ]);
    expect(campeaoDivergente(linhas)).toBeNull();
  });

  it("some com um produto só ou sem nenhum custo", () => {
    expect(campeaoDivergente(maisVendidos([venda([item("sol", 3, 49, 10)])]))).toBeNull();
    expect(
      campeaoDivergente(maisVendidos([venda([item("a", 3, 49)]), venda([item("b", 1, 9)])])),
    ).toBeNull();
  });
});

describe("estoque baixo", () => {
  it("no mínimo já é baixo", () => {
    expect(estoqueBaixo({ saldo: 5, estoqueMinimo: 5 })).toBe(true);
    expect(estoqueBaixo({ saldo: 6, estoqueMinimo: 5 })).toBe(false);
  });
  it("mínimo zero só avisa quando acaba", () => {
    expect(estoqueBaixo({ saldo: 1, estoqueMinimo: 0 })).toBe(false);
    expect(estoqueBaixo({ saldo: 0, estoqueMinimo: 0 })).toBe(true);
    expect(estoqueBaixo({ saldo: -1, estoqueMinimo: 0 })).toBe(true);
  });
  it("conta os baixos", () => {
    expect(
      contarEstoqueBaixo([
        { skuId: "1", saldo: 2, estoqueMinimo: 5 },
        { skuId: "2", saldo: 12, estoqueMinimo: 5 },
        { skuId: "3", saldo: 0, estoqueMinimo: 0 },
      ]),
    ).toBe(2);
  });
});

describe("resumoVendas", () => {
  it("entrou e a receber são líquidos da taxa, como no Financeiro", () => {
    const r = resumoVendas([
      { ...venda([item("a", 2, 50, 20)], { taxaCanal: 5 }), total: 100 },
      { ...venda([item("b", 1, 30, null)], { status: "a_receber", taxaCanal: 1 }), total: 30 },
      { ...venda([item("a", 9, 50, 20)], { status: "cancelada" }), total: 450 },
    ]);
    expect(r).toEqual({ quantidade: 2, entrou: 95, lucrou: 55, semCusto: 1, aReceber: 29 });
  });
});

describe("arredondamento igual ao do banco", () => {
  it("arredonda o preço de cada item antes de multiplicar", () => {
    // 10,555 vira 10,56 por item: 3 x 10,56 = 31,68 (o banco faz igual)
    expect(totalDaVenda({ itens: [item("a", 3, 10.555)], desconto: 0, frete: 0 })).toBe(31.68);
  });
});

describe("intervaloDoPeriodo", () => {
  const hoje = new Date(2026, 9, 23);
  it("este mês vai do dia 1 até hoje", () => {
    expect(intervaloDoPeriodo("mes", hoje)).toEqual({ de: "2026-10-01", ate: "2026-10-23" });
  });
  it("mês passado pega o mês inteiro", () => {
    expect(intervaloDoPeriodo("passado", hoje)).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
  });
  it("mês passado em janeiro volta pra dezembro", () => {
    expect(intervaloDoPeriodo("passado", new Date(2027, 0, 5))).toEqual({
      de: "2026-12-01",
      ate: "2026-12-31",
    });
  });
  it("90 dias conta hoje como um deles", () => {
    expect(intervaloDoPeriodo("90dias", hoje)).toEqual({ de: "2026-07-26", ate: "2026-10-23" });
  });
});

describe("diferencaDoAjuste", () => {
  it("guarda a diferença entre o contado e o saldo", () => {
    expect(diferencaDoAjuste(12, 10)).toBe(-2);
    expect(diferencaDoAjuste(-1, 3)).toBe(4);
    expect(diferencaDoAjuste(5, 5)).toBe(0);
  });
});

describe("frete pago pela vendedora (Mercado Livre)", () => {
  it("sai do lucro, como a taxa", () => {
    const v = venda([item("a", 2, 50, 20)], { taxaCanal: 12, custoEnvio: 20 });
    expect(lucroDaVenda(v)).toBe(100 - 12 - 20 - 40);
  });

  it("sai do que entra no Financeiro, igual à RPC receber_venda", () => {
    expect(
      valorRecebidoDaVenda({
        itens: [item("a", 2, 50)],
        desconto: 0,
        frete: 0,
        taxaCanal: 12,
        custoEnvio: 20,
      }),
    ).toBe(68);
  });

  it("entra no resumo e no rateio dos mais vendidos", () => {
    const v = {
      ...venda([item("a", 1, 60, 10), item("b", 1, 40, 10)], { custoEnvio: 10 }),
      total: 100,
    };
    expect(resumoVendas([v])).toMatchObject({ entrou: 90, lucrou: 70 });
    const linhas = maisVendidos([v], "lucrou");
    expect(linhas.find((l) => l.chave === "a")?.lucrou).toBe(60 - 6 - 10);
    expect(linhas.find((l) => l.chave === "b")?.lucrou).toBe(40 - 4 - 10);
  });

  it("venda sem o campo continua como antes", () => {
    expect(lucroDaVenda(venda([item("a", 1, 50, 20)], { taxaCanal: 5 }))).toBe(25);
  });
});
