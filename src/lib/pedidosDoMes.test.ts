import { describe, expect, it } from "vitest";
import type { LancamentoComOrigem } from "./lucroDoMes";
import { legendaDosPedidos, pedidosDoMes } from "./pedidosDoMes";
import { resumoVendas, type Venda } from "./vendas";

const entrada = (extra: Partial<LancamentoComOrigem> = {}): LancamentoComOrigem => ({
  tipo: "entrada",
  valor: 100,
  data: "2026-11-05",
  categoria: "Venda de produto",
  id_externo: null,
  ...extra,
});

const venda = (status: Venda["status"]): Venda & { total: number } => ({
  status,
  desconto: 0,
  taxaCanal: 0,
  custoEnvio: 0,
  total: 100,
  itens: [],
});

describe("pedidosDoMes (ONE-172)", () => {
  it("o caso do print: 8 pedidos, 4 pagos e 4 a receber, dá 8 nos dois cartões", () => {
    const vendas = [
      ...Array.from({ length: 4 }, () => venda("recebida")),
      ...Array.from({ length: 4 }, () => venda("a_receber")),
    ];
    const pagos = [1, 2, 3, 4].map((i) => entrada({ id_externo: `venda:${i}` }));

    const p = pedidosDoMes(pagos, vendas, 2026, 11);

    expect(p.total).toBe(8);
    expect(p.total).toBe(resumoVendas(vendas).quantidade);
    expect(legendaDosPedidos(p, 4)).toBe("vendas e serviços registrados");
  });

  it("entrada de venda lançada à mão conta, e a frase separa as duas", () => {
    const p = pedidosDoMes(
      [
        entrada({ id_externo: "venda:1" }),
        entrada(),
        entrada({ categoria: "Prestação de serviço" }),
      ],
      [venda("recebida")],
      2026,
      11,
    );
    expect(p).toEqual({ total: 3, vendas: 1, avulsas: 2, vendasLidas: true });
    expect(legendaDosPedidos(p, 3)).toBe("1 venda e 2 entradas lançadas à mão");
  });

  it("sem vendas registradas, conta as entradas lançadas à mão como antes", () => {
    const p = pedidosDoMes([entrada()], [], 2026, 11);
    expect(p.total).toBe(1);
    expect(legendaDosPedidos(p, 1)).toBe("venda ou serviço registrado");
  });

  it("venda cancelada não conta", () => {
    expect(pedidosDoMes([], [venda("cancelada"), venda("a_receber")], 2026, 11).total).toBe(1);
  });

  it("aporte, Outros, saída e outro mês não são pedido", () => {
    const p = pedidosDoMes(
      [
        entrada({ categoria: "Aporte" }),
        entrada({ categoria: "Outros" }),
        entrada({ categoria: null }),
        entrada({ tipo: "saida" }),
        entrada({ data: "2026-10-31" }),
      ],
      [],
      2026,
      11,
    );
    expect(p.total).toBe(0);
    expect(legendaDosPedidos(p, 3)).toBe("nenhuma entrada marcada como venda ou serviço");
    expect(legendaDosPedidos(pedidosDoMes([], [], 2026, 11), 0)).toBe("nenhuma ainda");
  });

  it("venda de outubro paga em novembro não conta em novembro", () => {
    const p = pedidosDoMes([entrada({ id_externo: "venda:antiga" })], [], 2026, 11);
    expect(p.total).toBe(0);
  });

  it("leitura das vendas que falha cai nos lançamentos e a frase avisa", () => {
    const p = pedidosDoMes([entrada({ id_externo: "venda:1" }), entrada()], null, 2026, 11);
    expect(p.total).toBe(2);
    expect(legendaDosPedidos(p, 2)).toBe(
      "entradas marcadas como venda · as vendas não carregaram agora",
    );
  });
});
