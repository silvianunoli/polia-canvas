import { describe, expect, it } from "vitest";
import {
  fraseAReceber,
  fraseDiferencaRecebida,
  liquidoDaVenda,
  listaAReceber,
  resumoAReceber,
  valorQueDeveCair,
  type ContaReceber,
  type VendaAReceber,
} from "./contasReceber";

const conta = (
  vencimento: string,
  valor: number,
  extra: Partial<ContaReceber> = {},
): ContaReceber => ({
  id: `c-${vencimento}-${valor}`,
  descricao: "Resto da encomenda",
  cliente: null,
  documento: null,
  valor,
  vencimento,
  categoria: null,
  parcela: null,
  parcelas: null,
  status: "a_receber",
  recebidoEm: null,
  valorRecebido: null,
  forma: null,
  ...extra,
});

const venda = (vencimento: string, liquido: number): VendaAReceber => ({
  id: `v-${vencimento}-${liquido}`,
  data: vencimento,
  vencimento,
  canal: "whatsapp",
  clienteNome: "Ana",
  liquido,
  forma: null,
});

describe("listaAReceber", () => {
  it("junta conta e venda por vencimento, a maior antes no mesmo dia, sem a recebida", () => {
    const lista = listaAReceber(
      [
        conta("2026-11-25", 180),
        conta("2026-11-20", 50),
        conta("2026-11-10", 999, {
          status: "recebida",
          recebidoEm: "2026-11-10",
          valorRecebido: 999,
        }),
      ],
      [venda("2026-11-20", 95), venda("2026-11-18", 40)],
    );
    expect(lista.map((i) => [i.tipo, i.vencimento, i.valor])).toEqual([
      ["venda", "2026-11-18", 40],
      ["venda", "2026-11-20", 95],
      ["conta", "2026-11-20", 50],
      ["conta", "2026-11-25", 180],
    ]);
  });
});

describe("resumoAReceber e fraseAReceber", () => {
  const hoje = "2026-11-19";
  it("soma o total e separa atrasadas e as da semana", () => {
    const r = resumoAReceber(
      listaAReceber(
        [conta("2026-11-15", 180), conta("2026-11-22", 100.1), conta("2026-12-20", 200)],
        [venda("2026-11-19", 49.9)],
      ),
      hoje,
    );
    expect(r.total).toEqual({ quantidade: 4, total: 530 });
    expect(r.atrasadas).toEqual({ quantidade: 1, total: 180 });
    expect(r.semana).toEqual({ quantidade: 2, total: 150 });
    expect(fraseAReceber(r)).toMatch(
      /^R\$\s530,00 pra receber · 1 atrasada \(R\$\s180,00\) · 2 vencem nos próximos 7 dias \(R\$\s150,00\)$/,
    );
  });
  it("fica vazia sem nada a receber", () => {
    expect(fraseAReceber(resumoAReceber([], hoje))).toBe("");
  });
});

describe("valorQueDeveCair", () => {
  it("desconta a taxa cadastrada pra forma", () => {
    expect(valorQueDeveCair(100, { percentual: 4.99, fixo: 0 })).toBe(95.01);
    expect(valorQueDeveCair(50, { percentual: 3.19, fixo: 0.5 })).toBe(47.9);
  });
  it("sem taxa cadastrada, o valor cheio", () => {
    expect(valorQueDeveCair(180, undefined)).toBe(180);
    expect(valorQueDeveCair(180, { percentual: 0, fixo: 0 })).toBe(180);
  });
});

describe("liquidoDaVenda", () => {
  it("tira taxa e frete pago por ela, como a receber_venda", () => {
    expect(liquidoDaVenda(120, 6.5, 0)).toBe(113.5);
    expect(liquidoDaVenda(0.1 + 0.2, 0, 0)).toBe(0.3);
    expect(liquidoDaVenda(200, 20, 18.9)).toBe(161.1);
  });
});

describe("fraseDiferencaRecebida", () => {
  it("fala em taxa quando caiu menos e em acréscimo quando caiu mais", () => {
    expect(fraseDiferencaRecebida(100, 95.01)).toMatch(
      /^R\$\s4,99 a menos que o combinado \(taxa ou desconto\)$/,
    );
    expect(fraseDiferencaRecebida(100, 102)).toMatch(
      /^R\$\s2,00 a mais que o combinado \(juros ou acréscimo\)$/,
    );
    expect(fraseDiferencaRecebida(100, 100)).toBe("");
    expect(fraseDiferencaRecebida(100, null)).toBe("");
  });
});
