import { describe, expect, it, vi } from "vitest";
import {
  legendaDoLucro,
  lerVendasDoPeriodo,
  lucroDoMes,
  type LancamentoComOrigem,
  type VendaDoMes,
} from "./lucroDoMes";
import { CATEGORIA_EQUIPAMENTO, CATEGORIA_INSUMOS } from "./projecao.functions";

const lanc = (
  tipo: "entrada" | "saida",
  valor: number,
  extra: Partial<LancamentoComOrigem> = {},
): LancamentoComOrigem => ({
  tipo,
  valor,
  data: "2026-11-01",
  categoria: null,
  id_externo: null,
  ...extra,
});

// O caso do teste de 01/11: custo R$ 15, preço R$ 23,08, 2 unidades.
const vendaCaderno = (extra: Partial<VendaDoMes> = {}): VendaDoMes => ({
  status: "recebida",
  desconto: 0,
  taxaCanal: 0,
  custoEnvio: 0,
  total: 46.16,
  itens: [
    {
      produtoId: "p1",
      produtoNome: "Caderno A5",
      quantidade: 2,
      precoUnitario: 23.08,
      custoUnitario: 15,
    },
  ],
  ...extra,
});

// O lançamento que a RPC receber_venda grava pra essa venda.
const entradaDaVenda = lanc("entrada", 46.16, {
  categoria: "Venda de produto",
  id_externo: "venda:abc",
});

describe("lucroDoMes", () => {
  it("conta nova só com a venda: dá o lucro da venda, não tudo que entrou", () => {
    const r = lucroDoMes([entradaDaVenda], [vendaCaderno()], 2026, 11);
    expect(r).toEqual({
      valor: 16.16,
      base: 46.16,
      fonte: "vendas",
      motivo: null,
      aReceber: 0,
      semCusto: 0,
    });
  });

  it("venda + saída de custo fixo: o custo fixo sai do lucro", () => {
    const r = lucroDoMes(
      [entradaDaVenda, lanc("saida", 10, { categoria: "Internet" })],
      [vendaCaderno()],
      2026,
      11,
    );
    expect(r.valor).toBe(6.16);
    expect(r.fonte).toBe("vendas");
  });

  it("venda + saída de Insumos: não desconta o material de novo", () => {
    const r = lucroDoMes(
      [
        entradaDaVenda,
        lanc("saida", 100, { categoria: CATEGORIA_INSUMOS }),
        lanc("saida", 5, { categoria: "insumos / ESTOQUE " }),
      ],
      [vendaCaderno()],
      2026,
      11,
    );
    expect(r.valor).toBe(16.16);
  });

  it("venda + compra de equipamento: a máquina não sai do lucro do mês", () => {
    const r = lucroDoMes(
      [entradaDaVenda, lanc("saida", 1359, { categoria: CATEGORIA_EQUIPAMENTO })],
      [vendaCaderno()],
      2026,
      11,
    );
    expect(r.valor).toBe(16.16);
  });

  it("mês sem venda: a compra de equipamento fica fora, a outra saída não", () => {
    const r = lucroDoMes(
      [
        lanc("saida", 1359, { categoria: CATEGORIA_EQUIPAMENTO }),
        lanc("saida", 30, { categoria: "Internet" }),
        lanc("saida", 2000, { categoria: CATEGORIA_EQUIPAMENTO, data: "2026-10-05" }),
      ],
      [],
      2026,
      11,
    );
    expect(r.valor).toBe(-30);
    expect(r.fonte).toBe("caixa");
    expect(r.compraDeEquipamento).toBe(1359);
  });

  it("legenda avisa quando a compra de equipamento ficou fora", () => {
    const so = lucroDoMes(
      [lanc("saida", 1359, { categoria: CATEGORIA_EQUIPAMENTO })],
      [],
      2026,
      11,
    );
    expect(so.valor).toBe(0);
    expect(legendaDoLucro(so)).toBe("sem a compra de equipamento");
    expect(legendaDoLucro(lucroDoMes([], [], 2026, 11))).toBe("registre entradas e saídas pra ver");
  });

  it("entrada avulsa sem venda no mês: fica na conta de caixa", () => {
    const r = lucroDoMes(
      [
        lanc("entrada", 200, { categoria: "Prestação de serviço" }),
        lanc("saida", 50, { categoria: CATEGORIA_INSUMOS }),
      ],
      [],
      2026,
      11,
    );
    expect(r).toEqual({
      valor: 150,
      base: 200,
      fonte: "caixa",
      motivo: "sem_vendas",
      aReceber: 0,
      semCusto: 0,
    });
  });

  it("venda + entrada avulsa: a avulsa entra inteira, a da venda não entra duas vezes", () => {
    const r = lucroDoMes(
      [entradaDaVenda, lanc("entrada", 80, { categoria: "Prestação de serviço" })],
      [vendaCaderno()],
      2026,
      11,
    );
    expect(r.valor).toBe(96.16);
    expect(r.base).toBe(126.16);
  });

  it("venda com item sem custo: só ela entra inteira, as outras seguem pelo custo", () => {
    const semCusto = vendaCaderno({
      itens: [
        {
          produtoId: "p2",
          produtoNome: "Agenda",
          quantidade: 1,
          precoUnitario: 40,
          custoUnitario: null,
        },
      ],
      total: 40,
    });
    const r = lucroDoMes(
      [entradaDaVenda, lanc("entrada", 40, { id_externo: "venda:def" }), lanc("saida", 6)],
      [vendaCaderno(), semCusto],
      2026,
      11,
    );
    // 16,16 do caderno + 40 da agenda sem custo - 6 de saída. Antes o mês
    // inteiro virava entradas - saídas (80,16) e o custo do caderno sumia.
    expect(r).toEqual({
      valor: 50.16,
      base: 86.16,
      fonte: "vendas",
      motivo: null,
      aReceber: 0,
      semCusto: 1,
    });
  });

  it("venda com dois itens e só um sem custo: desconta o custo que existe", () => {
    const mista = vendaCaderno({
      itens: [
        ...vendaCaderno().itens,
        {
          produtoId: "p2",
          produtoNome: "Agenda",
          quantidade: 1,
          precoUnitario: 40,
          custoUnitario: null,
        },
      ],
      total: 86.16,
    });
    const r = lucroDoMes([], [mista], 2026, 11);
    expect(r.valor).toBe(56.16);
    expect(r.semCusto).toBe(1);
  });

  it("leitura das vendas que falhou: conta antiga, com o motivo", () => {
    const r = lucroDoMes([entradaDaVenda], null, 2026, 11);
    expect(r.fonte).toBe("caixa");
    expect(r.motivo).toBe("vendas_nao_lidas");
    expect(r.valor).toBe(46.16);
  });

  it("venda cancelada não conta; se só sobrou ela, é mês sem venda", () => {
    const r = lucroDoMes([], [vendaCaderno({ status: "cancelada" })], 2026, 11);
    expect(r.fonte).toBe("caixa");
    expect(r.motivo).toBe("sem_vendas");
  });

  it("venda a receber entra no lucro, como no cartão de Vendas, e aparece em aReceber", () => {
    const r = lucroDoMes([], [vendaCaderno({ status: "a_receber" })], 2026, 11);
    expect(r).toEqual({
      valor: 16.16,
      base: 46.16,
      fonte: "vendas",
      motivo: null,
      aReceber: 46.16,
      semCusto: 0,
    });
  });

  it("taxa do canal sai do lucro e da base", () => {
    const r = lucroDoMes(
      [lanc("entrada", 41.16, { id_externo: "venda:abc" })],
      [vendaCaderno({ taxaCanal: 5 })],
      2026,
      11,
    );
    expect(r.valor).toBe(11.16);
    expect(r.base).toBe(41.16);
  });

  it("lançamento de outro mês fica fora", () => {
    const r = lucroDoMes(
      [
        entradaDaVenda,
        lanc("saida", 999, { data: "2026-10-31" }),
        lanc("entrada", 999, { data: "2026-12-01" }),
      ],
      [vendaCaderno()],
      2026,
      11,
    );
    expect(r.valor).toBe(16.16);
  });

  it("sem a origem do lançamento: avulsa = entradas - recebido das vendas, mínimo 0", () => {
    const semOrigem = (l: LancamentoComOrigem) => {
      const { id_externo: _, ...resto } = l;
      return resto;
    };
    const r = lucroDoMes(
      [semOrigem(entradaDaVenda), semOrigem(lanc("entrada", 30))],
      [vendaCaderno()],
      2026,
      11,
    );
    expect(r.valor).toBe(46.16);
    expect(r.base).toBe(76.16);

    const soVenda = lucroDoMes([], [vendaCaderno()], 2026, 11);
    expect(soVenda.valor).toBe(16.16);
  });

  it("saída maior que o lucro deixa o número negativo", () => {
    const r = lucroDoMes(
      [entradaDaVenda, lanc("saida", 50, { categoria: "Aluguel" })],
      [vendaCaderno()],
      2026,
      11,
    );
    expect(r.valor).toBe(-33.84);
  });
});

describe("legendaDoLucro", () => {
  it("pelas vendas: percentual do que entrou e de onde veio o número", () => {
    const l = lucroDoMes([entradaDaVenda], [vendaCaderno()], 2026, 11);
    expect(legendaDoLucro(l)).toBe("35% do que entrou · pelo custo de cada produto");
  });

  it("com venda a receber: percentual do que vendeu e quanto ainda vai entrar", () => {
    const l = lucroDoMes([], [vendaCaderno({ status: "a_receber" })], 2026, 11);
    expect(legendaDoLucro(l)).toBe(
      "35% do que vendeu, com R$ 46,16 ainda a receber · pelo custo de cada produto",
    );
  });

  it("venda sem custo: conta quantas e diz onde preencher", () => {
    const l = lucroDoMes(
      [entradaDaVenda],
      [vendaCaderno({ itens: [{ ...vendaCaderno().itens[0], custoUnitario: null }] })],
      2026,
      11,
    );
    expect(legendaDoLucro(l)).toBe("100% do que entrou · 1 venda sem custo, preencha em Produtos");

    const duas = lucroDoMes(
      [],
      [
        vendaCaderno({ itens: [{ ...vendaCaderno().itens[0], custoUnitario: null }] }),
        vendaCaderno({ itens: [{ ...vendaCaderno().itens[0], custoUnitario: null }] }),
      ],
      2026,
      11,
    );
    expect(legendaDoLucro(duas)).toBe(
      "100% do que entrou · 2 vendas sem custo, preencha em Produtos",
    );
  });

  it("sem venda: a frase de sempre", () => {
    expect(
      legendaDoLucro(lucroDoMes([lanc("entrada", 100), lanc("saida", 40)], [], 2026, 11)),
    ).toBe("60% de tudo que entrou");
    expect(legendaDoLucro(lucroDoMes([], [], 2026, 11))).toBe("registre entradas e saídas pra ver");
  });

  it("vendas que não carregaram: avisa", () => {
    expect(legendaDoLucro(lucroDoMes([entradaDaVenda], null, 2026, 11))).toBe(
      "entradas menos saídas · as vendas não carregaram agora",
    );
  });
});

describe("lerVendasDoPeriodo", () => {
  it("filtra pela dona e pelo período e converte os números", async () => {
    const chamadas: [string, ...unknown[]][] = [];
    const consulta: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "order", "range"]) {
      consulta[m] = (...args: unknown[]) => {
        chamadas.push([m, ...args]);
        return consulta;
      };
    }
    consulta.then = (ok: (r: unknown) => unknown) =>
      Promise.resolve(
        ok({
          data: [
            {
              status: "recebida",
              desconto: "0",
              taxa_canal: "1.5",
              custo_envio: null,
              total: "46.16",
              venda_itens: [
                {
                  produto_id: "p1",
                  produto_nome: "Caderno A5",
                  quantidade: 2,
                  preco_unitario: "23.08",
                  custo_unitario: null,
                },
              ],
            },
          ],
          error: null,
        }),
      );
    const client = { from: vi.fn(() => consulta) };
    const r = await lerVendasDoPeriodo(client as never, "u1", "2026-11-01", "2026-11-30");
    expect(client.from).toHaveBeenCalledWith("vendas");
    expect(chamadas).toContainEqual(["eq", "user_id", "u1"]);
    expect(chamadas).toContainEqual(["gte", "data", "2026-11-01"]);
    expect(chamadas).toContainEqual(["lte", "data", "2026-11-30"]);
    expect(r).toEqual([
      {
        status: "recebida",
        desconto: 0,
        taxaCanal: 1.5,
        custoEnvio: 0,
        total: 46.16,
        itens: [
          {
            produtoId: "p1",
            produtoNome: "Caderno A5",
            quantidade: 2,
            precoUnitario: 23.08,
            custoUnitario: null,
          },
        ],
      },
    ]);
  });

  it("erro de leitura sobe", async () => {
    const consulta: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lte", "order", "range"]) consulta[m] = () => consulta;
    consulta.then = (ok: (r: unknown) => unknown) =>
      Promise.resolve(ok({ data: null, error: new Error("falhou") }));
    await expect(
      lerVendasDoPeriodo({ from: () => consulta } as never, "u1", "2026-11-01", "2026-11-30"),
    ).rejects.toThrow("falhou");
  });
});
