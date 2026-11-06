import { describe, expect, it } from "vitest";
import {
  amanhaEmBrasilia,
  avisoEntregasAmanha,
  linhaDoPedido,
  montarEmailEntregasAmanha,
  type PedidoDaEntrega,
} from "../../supabase/functions/_shared/entregasAmanha.ts";

const JOANA: PedidoDaEntrega = {
  cliente: "Joana",
  status: "a_receber",
  total: 36,
  itens: [{ nome: "Bolo de pote", variacao: null, quantidade: 2 }],
};
const BIA: PedidoDaEntrega = {
  cliente: "Bia",
  status: "recebida",
  total: 30,
  itens: [{ nome: "Brigadeiro", variacao: "Belga", quantidade: 6 }],
};

describe("amanhaEmBrasilia", () => {
  it("às 18h de Brasília pega o dia seguinte", () => {
    expect(amanhaEmBrasilia(new Date("2026-11-05T21:00:00Z"))).toBe("2026-11-06");
  });

  it("usa o dia de Brasília, não o UTC, e vira o mês", () => {
    // 02h UTC de 01/12 ainda é 23h de 30/11 em Brasília.
    expect(amanhaEmBrasilia(new Date("2026-12-01T02:00:00Z"))).toBe("2026-12-01");
    expect(amanhaEmBrasilia(new Date("2026-11-30T21:00:00Z"))).toBe("2026-12-01");
  });
});

describe("linhaDoPedido", () => {
  it("a receber mostra o valor, pago não", () => {
    expect(linhaDoPedido(JOANA)).toMatch(/^Joana · 2x Bolo de pote · a receber R\$\s36,00$/);
    expect(linhaDoPedido(BIA)).toBe("Bia · 6x Brigadeiro Belga · pago");
  });

  it("junta os itens e cai em Sem nome como o cartão do quadro", () => {
    const linha = linhaDoPedido({
      cliente: "  ",
      status: "recebida",
      total: 10,
      itens: [
        { nome: "Bolo", variacao: null, quantidade: 1 },
        { nome: "Torta", variacao: null, quantidade: 2 },
      ],
    });
    expect(linha).toBe("Sem nome · 1x Bolo, 2x Torta · pago");
  });
});

describe("avisoEntregasAmanha", () => {
  it("acerta o plural, abre os Pedidos e não leva nome de cliente", () => {
    expect(avisoEntregasAmanha(1).titulo).toBe("Amanhã: 1 entrega");
    expect(avisoEntregasAmanha(2).titulo).toBe("Amanhã: 2 entregas");
    expect(avisoEntregasAmanha(2).rota).toBe("/pedidos");
  });
});

describe("montarEmailEntregasAmanha", () => {
  it("o assunto conta os pedidos e o corpo lista cada um", () => {
    expect(montarEmailEntregasAmanha([JOANA]).assunto).toBe("Amanhã: 1 entrega na Pólia One");
    const email = montarEmailEntregasAmanha([JOANA, BIA]);
    expect(email.assunto).toBe("Amanhã: 2 entregas na Pólia One");
    expect(email.texto).toContain("Bia · 6x Brigadeiro Belga · pago");
    expect(email.html).toContain("Bia · 6x Brigadeiro Belga · pago");
    expect(email.html).toContain("https://one.usepolia.com.br/pedidos");
    expect(email.html).toContain("Quero abrir os pedidos");
  });

  it("escapa o que veio da vitrine pública", () => {
    const { html, texto } = montarEmailEntregasAmanha([
      { ...JOANA, cliente: '<img src=x onerror="alert(1)">' },
      {
        ...BIA,
        itens: [{ nome: "<b>Bolo</b>", variacao: null, quantidade: 1 }],
      },
    ]);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Bolo");
    expect(html).toContain("&lt;img src=x");
    expect(texto).toContain("<b>Bolo</b>");
  });

  it("copy sem exclamação, sem travessão e com saída por Configurações", () => {
    const email = montarEmailEntregasAmanha([JOANA, BIA]);
    const aviso = avisoEntregasAmanha(2);
    for (const t of [email.assunto, email.texto, aviso.titulo, aviso.corpo]) {
      expect(t).not.toMatch(/[!—–]/);
      expect(t.toLowerCase()).not.toMatch(/quanto sobra|margem|jornada|etapa|trilha/);
    }
    expect(email.texto).toContain("desligar em Configurações");
  });
});
