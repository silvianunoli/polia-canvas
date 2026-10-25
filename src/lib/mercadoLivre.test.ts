import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  anuncioNoFull,
  anunciosDoItem,
  dataDoPedido,
  desafioPkce,
  gerarVerificadorPkce,
  itensDoPedido,
  pedidoDoAviso,
  skuExternoDe,
  statusVendaDoPedido,
  tarifaDoPedido,
  tokensDaResposta,
  urlDeAutorizacao,
  type PedidoApiMl,
} from "../../supabase/functions/_shared/mercadoLivre.ts";
import { diaEmBrasilia } from "../../supabase/functions/_shared/canais.ts";

describe("PKCE", () => {
  it("verificador tem 64 caracteres do alfabeto permitido", () => {
    const v = gerarVerificadorPkce();
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(gerarVerificadorPkce()).not.toBe(v);
  });

  it("desafio é o SHA-256 em base64url sem preenchimento", async () => {
    const v = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const esperado = createHash("sha256").update(v).digest("base64url");
    expect(await desafioPkce(v)).toBe(esperado);
    // Exemplo do apêndice B da RFC 7636.
    expect(await desafioPkce(v)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("url de autorização", () => {
  it("leva client_id, redirect, state e o desafio S256", () => {
    const url = new URL(
      urlDeAutorizacao({
        clientId: "123",
        redirectUri: "https://exemplo.test/configuracoes/integracoes/mercado-livre",
        state: "st-1",
        desafio: "abc",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://auth.mercadolivre.com.br/authorization");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://exemplo.test/configuracoes/integracoes/mercado-livre",
    );
    expect(url.searchParams.get("state")).toBe("st-1");
    expect(url.searchParams.get("code_challenge")).toBe("abc");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("tokens", () => {
  const agora = new Date("2026-10-24T12:00:00Z");

  it("access vence em expires_in segundos e a vendedora vira texto", () => {
    expect(
      tokensDaResposta(
        { access_token: "A", refresh_token: "R", expires_in: 21600, user_id: 468424240 },
        agora,
      ),
    ).toEqual({
      accessToken: "A",
      refreshToken: "R",
      accessExpiraEm: "2026-10-24T18:00:00.000Z",
      vendedoraId: "468424240",
    });
  });

  it("sem expires_in assume as 6 horas da doc", () => {
    expect(
      tokensDaResposta({ access_token: "A", refresh_token: "R", user_id: "1" }, agora)
        ?.accessExpiraEm,
    ).toBe("2026-10-24T18:00:00.000Z");
  });

  it("sem refresh_token (faltou acesso offline) ou sem vendedora não serve", () => {
    expect(tokensDaResposta({ access_token: "A", user_id: 1 }, agora)).toBeNull();
    expect(tokensDaResposta({ access_token: "A", refresh_token: "R" }, agora)).toBeNull();
    expect(tokensDaResposta({}, agora)).toBeNull();
  });
});

describe("status do pedido", () => {
  it("pago e devolução parcial viram venda a receber", () => {
    expect(statusVendaDoPedido({ status: "paid" })).toBe("a_receber");
    expect(statusVendaDoPedido({ status: "partially_refunded" })).toBe("a_receber");
  });

  it("pagamento pendente não entra", () => {
    for (const s of ["payment_required", "payment_in_process", "confirmed", undefined])
      expect(statusVendaDoPedido({ status: s })).toBeNull();
  });

  it("cancelado ou com risco de fraude cancela", () => {
    expect(statusVendaDoPedido({ status: "cancelled" })).toBe("cancelada");
    expect(statusVendaDoPedido({ status: "paid", tags: ["fraud_risk_detected"] })).toBe(
      "cancelada",
    );
  });
});

describe("pedido do Mercado Livre → venda", () => {
  const pedido: PedidoApiMl = {
    id: 2000001,
    status: "paid",
    date_created: "2026-10-24T01:30:00.000-04:00",
    date_closed: "2026-10-24T01:35:00.000-04:00",
    order_items: [
      {
        item: {
          id: "MLB111",
          title: " Caneca Gato ",
          variation_id: 555,
          variation_attributes: [{ name: "Cor", value_name: "Azul" }],
        },
        quantity: 2,
        unit_price: 39.9,
        sale_fee: 5.99,
      },
      { item: { id: "MLB222", title: "Bolsa Lona" }, quantity: 1, unit_price: 80, sale_fee: 12.8 },
      { item: { title: "sem id" }, quantity: 1, unit_price: 10 },
    ],
  };

  it("chave do vínculo junta anúncio e variação", () => {
    expect(skuExternoDe("MLB111", 555)).toBe("MLB111:555");
    expect(skuExternoDe("MLB222", null)).toBe("MLB222");
    expect(skuExternoDe("MLB222", undefined)).toBe("MLB222");
  });

  it("itens trazem o vínculo, o nome da variação e o preço unitário", () => {
    const itens = itensDoPedido(pedido, new Map([["MLB111:555", "sku-azul"]]));
    expect(itens).toEqual([
      {
        sku_id: "sku-azul",
        nome: "Caneca Gato",
        variacao: "Azul",
        quantidade: 2,
        preco_unitario: 39.9,
      },
      { sku_id: null, nome: "Bolsa Lona", variacao: null, quantidade: 1, preco_unitario: 80 },
    ]);
  });

  it("tarifa real soma sale_fee vezes a quantidade", () => {
    expect(tarifaDoPedido(pedido)).toBe(24.78);
    expect(tarifaDoPedido({ order_items: [] })).toBe(0);
    expect(tarifaDoPedido({ order_items: [{ quantity: 1, sale_fee: -3 }] })).toBe(0);
  });

  it("dia da venda é o fechamento, no horário de Brasília", () => {
    // 01:35 em -04:00 = 05:35 UTC = 02:35 em Brasília, ainda dia 24.
    expect(dataDoPedido(pedido)).toBe("2026-10-24");
    expect(dataDoPedido({ date_created: "2026-10-24T02:00:00Z" })).toBe("2026-10-23");
    const agora = new Date("2026-10-24T15:00:00Z");
    expect(dataDoPedido({ date_closed: "lixo" }, agora)).toBe(diaEmBrasilia(agora));
    expect(dataDoPedido({}, agora)).toBe("2026-10-24");
  });
});

describe("aviso do Mercado Livre", () => {
  const aviso = {
    _id: "x",
    resource: "/orders/2195160686",
    user_id: 468424240,
    topic: "orders_v2",
    application_id: 5503910054141466,
    attempts: 1,
  };

  it("pedido do próprio app vira id na fila", () => {
    expect(pedidoDoAviso(aviso, "5503910054141466")).toEqual({
      vendedoraId: "468424240",
      pedidoId: "2195160686",
    });
  });

  it("outro app, outro tópico ou recurso estranho é ignorado", () => {
    expect(pedidoDoAviso(aviso, "999")).toBeNull();
    expect(pedidoDoAviso({ ...aviso, topic: "items" }, "5503910054141466")).toBeNull();
    expect(
      pedidoDoAviso({ ...aviso, resource: "/orders/1/../users" }, "5503910054141466"),
    ).toBeNull();
    expect(pedidoDoAviso({ ...aviso, user_id: "abc" }, "5503910054141466")).toBeNull();
    expect(pedidoDoAviso(null, "5503910054141466")).toBeNull();
    expect(pedidoDoAviso("texto", "5503910054141466")).toBeNull();
  });
});

describe("anúncio no Full", () => {
  it("só fulfillment é Full", () => {
    expect(anuncioNoFull({ shipping: { logistic_type: "fulfillment" } })).toBe(true);
    expect(anuncioNoFull({ shipping: { logistic_type: "cross_docking" } })).toBe(false);
    expect(anuncioNoFull({})).toBe(false);
  });
});

describe("anúncios do Mercado Livre → linhas da prévia", () => {
  it("anúncio sem variação vira uma linha com o código do SELLER_SKU", () => {
    expect(
      anunciosDoItem({
        id: "MLB1",
        title: " Bolsa Lona ",
        status: "active",
        price: 80,
        available_quantity: 3,
        seller_custom_field: "ANTIGO",
        attributes: [{ id: "SELLER_SKU", value_name: "BOL-01" }],
        shipping: { logistic_type: "cross_docking" },
      }),
    ).toEqual([
      {
        produtoExternoId: "MLB1",
        skuExternoId: "MLB1",
        codigo: "BOL-01",
        titulo: "Bolsa Lona",
        variacao: null,
        preco: 80,
        quantidade: 3,
        status: "active",
        estoqueDoCanal: false,
      },
    ]);
  });

  it("sem SELLER_SKU usa o campo antigo; sem nada fica sem código", () => {
    expect(anunciosDoItem({ id: "MLB1", seller_custom_field: " X1 " })[0].codigo).toBe("X1");
    expect(anunciosDoItem({ id: "MLB1" })[0].codigo).toBeNull();
  });

  it("uma linha por variação, com a chave anúncio:variação e o preço da variação", () => {
    const linhas = anunciosDoItem({
      id: "MLB2",
      title: "Caneca Gato",
      price: 39.9,
      shipping: { logistic_type: "fulfillment" },
      variations: [
        {
          id: 101,
          available_quantity: 4,
          attribute_combinations: [
            { name: "Cor", value_name: "Azul" },
            { name: "Tamanho", value_name: "350 ml" },
          ],
          attributes: [{ id: "SELLER_SKU", value_name: "CAN-AZ" }],
        },
        { id: 102, price: 42, available_quantity: -1, seller_custom_field: "CAN-RS" },
        { price: 10 },
      ],
    });
    expect(
      linhas.map((l) => [l.skuExternoId, l.codigo, l.variacao, l.preco, l.quantidade]),
    ).toEqual([
      ["MLB2:101", "CAN-AZ", "Azul / 350 ml", 39.9, 4],
      ["MLB2:102", "CAN-RS", null, 42, 0],
    ]);
    expect(linhas.every((l) => l.estoqueDoCanal)).toBe(true);
  });

  it("anúncio sem id é descartado", () => {
    expect(anunciosDoItem({ title: "sem id" })).toEqual([]);
  });
});
