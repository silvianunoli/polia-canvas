import { describe, expect, it } from "vitest";
import {
  menosVendidos,
  resumoProdutos,
  ticketMedio,
  topMaisVendidos,
} from "@/lib/painelOperacional";
import type { Venda } from "@/lib/vendas";

const produto = (
  id: string,
  extra: Partial<{
    controlaEstoque: boolean;
    criadoEm: string;
    skus: { saldo: number; estoqueMinimo: number }[];
  }> = {},
) => ({
  id,
  nome: `Produto ${id}`,
  controlaEstoque: false,
  criadoEm: "2026-01-01T00:00:00Z",
  skus: [],
  ...extra,
});

const venda = (
  itens: { produtoId: string; quantidade: number; preco: number }[],
  status: Venda["status"] = "recebida",
): Venda & { total: number } => ({
  status,
  desconto: 0,
  taxaCanal: 0,
  itens: itens.map((i) => ({
    produtoId: i.produtoId,
    produtoNome: `Produto ${i.produtoId}`,
    quantidade: i.quantidade,
    precoUnitario: i.preco,
    custoUnitario: null,
  })),
  total: itens.reduce((s, i) => s + i.quantidade * i.preco, 0),
});

describe("resumoProdutos", () => {
  it("conta ativos, inativos, sem estoque e estoque baixo", () => {
    const r = resumoProdutos(
      [
        produto("encomenda"),
        produto("zerado", { controlaEstoque: true, skus: [{ saldo: 0, estoqueMinimo: 0 }] }),
        produto("sem-sku", { controlaEstoque: true }),
        produto("baixo", {
          controlaEstoque: true,
          skus: [
            { saldo: 5, estoqueMinimo: 2 },
            { saldo: 1, estoqueMinimo: 2 },
          ],
        }),
        produto("ok", { controlaEstoque: true, skus: [{ saldo: 10, estoqueMinimo: 2 }] }),
      ],
      71,
    );
    expect(r).toEqual({ ativos: 5, inativos: 71, semEstoque: 2, estoqueBaixo: 1 });
  });

  it("saldo negativo de uma variação não abate o positivo de outra", () => {
    const r = resumoProdutos(
      [
        produto("a", {
          controlaEstoque: true,
          skus: [
            { saldo: -3, estoqueMinimo: 0 },
            { saldo: 2, estoqueMinimo: 0 },
          ],
        }),
      ],
      0,
    );
    expect(r.semEstoque).toBe(0);
  });

  it("produto por encomenda (estoque desligado) nunca conta como sem estoque", () => {
    expect(resumoProdutos([produto("a")], 0).semEstoque).toBe(0);
  });
});

describe("ticketMedio", () => {
  it("divide o que as clientes pagaram pelo número de vendas, sem as canceladas", () => {
    const t = ticketMedio([
      venda([{ produtoId: "a", quantidade: 1, preco: 40 }]),
      venda([{ produtoId: "b", quantidade: 2, preco: 25 }], "a_receber"),
      venda([{ produtoId: "c", quantidade: 1, preco: 999 }], "cancelada"),
    ]);
    expect(t).toEqual({ vendas: 2, total: 90, ticket: 45 });
  });

  it("sem venda, o ticket fica vazio", () => {
    expect(ticketMedio([]).ticket).toBeNull();
  });
});

describe("mais e menos vendidos", () => {
  const vendas = [
    venda([
      { produtoId: "a", quantidade: 5, preco: 10 },
      { produtoId: "b", quantidade: 3, preco: 10 },
    ]),
    venda([
      { produtoId: "c", quantidade: 2, preco: 10 },
      { produtoId: "d", quantidade: 1, preco: 10 },
    ]),
  ];
  const ativos = [
    produto("a"),
    produto("b"),
    produto("c"),
    produto("d"),
    produto("parado-novo", { criadoEm: "2026-11-20T00:00:00Z" }),
    produto("parado-antigo", { criadoEm: "2025-06-01T00:00:00Z" }),
  ];

  it("mais vendidos por unidades, até 3", () => {
    expect(topMaisVendidos(vendas).map((l) => l.chave)).toEqual(["a", "b", "c"]);
  });

  it("menos vendidos começa pelos sem venda, o mais antigo primeiro, e não repete o topo", () => {
    expect(menosVendidos(vendas, ativos).map((l) => [l.id, l.unidades])).toEqual([
      ["parado-antigo", 0],
      ["parado-novo", 0],
      ["d", 1],
    ]);
  });

  it("sem venda no período, a lista de menos vendidos fica vazia", () => {
    expect(menosVendidos([], ativos)).toEqual([]);
  });

  it("produto arquivado não entra nos menos vendidos", () => {
    const lista = menosVendidos(vendas, [produto("a"), produto("d")]);
    expect(lista.map((l) => l.id)).toEqual(["d"]);
  });
});
