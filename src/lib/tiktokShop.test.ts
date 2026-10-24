import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  anunciosDoProduto,
  assinarChamada,
  corpoAtualizarEstoque,
  depositosDoProduto,
  dataDoPedido,
  itensDoPedido,
  pedidoDoWebhook,
  taxaEstimada,
  precisaDetalhe,
  statusVendaDoPedido,
  sugerirVinculos,
  textoDaAssinatura,
  urlDeAutorizacao,
  webhookAutentico,
  type AnuncioCanal,
  type SkuPolia,
} from "../../supabase/functions/_shared/tiktokShop.ts";
import { taxaDaVenda } from "./taxas";

const SECRET = "segredo-de-teste";

describe("assinatura das chamadas", () => {
  it("ordena os parâmetros, ignora sign e access_token e envolve com o secret", () => {
    const texto = textoDaAssinatura({
      path: "/order/202309/orders/search",
      query: {
        timestamp: "1700000000",
        app_key: "abc",
        sign: "x",
        access_token: "y",
        shop_cipher: "C1",
      },
      body: '{"order_status":"AWAITING_SHIPMENT"}',
      appSecret: SECRET,
    });
    expect(texto).toBe(
      `${SECRET}/order/202309/orders/searchapp_keyabcshop_cipherC1timestamp1700000000{"order_status":"AWAITING_SHIPMENT"}${SECRET}`,
    );
  });

  it("assina com HMAC-SHA256 em hex, igual ao node:crypto", async () => {
    const p = {
      path: "/authorization/202309/shops",
      query: { app_key: "abc", timestamp: "1" },
      appSecret: SECRET,
    };
    const esperado = createHmac("sha256", SECRET).update(textoDaAssinatura(p)).digest("hex");
    expect(await assinarChamada(p)).toBe(esperado);
  });

  it("sem corpo, não acrescenta nada entre os parâmetros e o secret final", () => {
    expect(textoDaAssinatura({ path: "/p", query: { a: "1" }, appSecret: "s" })).toBe("s/pa1s");
  });
});

describe("webhook", () => {
  const corpo = '{"type":1,"shop_id":"7000","data":{"order_id":"5770"}}';
  const valida = createHmac("sha256", SECRET).update(`chave${corpo}`).digest("hex");

  it("aceita a assinatura certa, mesmo em maiúsculas", async () => {
    expect(
      await webhookAutentico({
        appKey: "chave",
        appSecret: SECRET,
        corpoCru: corpo,
        assinatura: valida,
      }),
    ).toBe(true);
    expect(
      await webhookAutentico({
        appKey: "chave",
        appSecret: SECRET,
        corpoCru: corpo,
        assinatura: valida.toUpperCase(),
      }),
    ).toBe(true);
  });

  it("recusa corpo reformatado, assinatura errada ou ausente", async () => {
    const reformatado = JSON.stringify(JSON.parse(corpo), null, 2);
    expect(
      await webhookAutentico({
        appKey: "chave",
        appSecret: SECRET,
        corpoCru: reformatado,
        assinatura: valida,
      }),
    ).toBe(false);
    expect(
      await webhookAutentico({
        appKey: "chave",
        appSecret: SECRET,
        corpoCru: corpo,
        assinatura: "abc",
      }),
    ).toBe(false);
    expect(
      await webhookAutentico({
        appKey: "chave",
        appSecret: SECRET,
        corpoCru: corpo,
        assinatura: null,
      }),
    ).toBe(false);
  });
});

describe("status do pedido", () => {
  it("pago vira a receber, não pago não entra, cancelado cancela", () => {
    expect(statusVendaDoPedido("UNPAID")).toBeNull();
    expect(statusVendaDoPedido("ON_HOLD")).toBe("a_receber");
    expect(statusVendaDoPedido("AWAITING_SHIPMENT")).toBe("a_receber");
    expect(statusVendaDoPedido("COMPLETED")).toBe("a_receber");
    expect(statusVendaDoPedido("CANCELLED")).toBe("cancelada");
    expect(statusVendaDoPedido("QUALQUER_OUTRO")).toBeNull();
    expect(statusVendaDoPedido(undefined)).toBeNull();
  });
});

describe("url de autorização", () => {
  it("leva o service_id e o state", () => {
    const url = new URL(urlDeAutorizacao("7699", "st-1"));
    expect(url.origin + url.pathname).toBe("https://services.tiktokshop.com/open/authorize");
    expect(url.searchParams.get("service_id")).toBe("7699");
    expect(url.searchParams.get("state")).toBe("st-1");
  });
});

describe("sugestão de vínculo", () => {
  const skus: SkuPolia[] = [
    { skuId: "s1", codigo: "CAN-AZ", produtoNome: "Caneca Gato", variacao: "Azul" },
    { skuId: "s2", codigo: "CAN-RS", produtoNome: "Caneca Gato", variacao: "Rosa" },
    { skuId: "s3", codigo: null, produtoNome: "Bolsa Lona", variacao: null },
    { skuId: "s4", codigo: null, produtoNome: "Ecobag", variacao: null },
    { skuId: "s5", codigo: null, produtoNome: "Ecobag", variacao: null },
  ];
  const anuncio = (id: string, extra: Partial<AnuncioCanal>): AnuncioCanal => ({
    produtoExternoId: "p",
    skuExternoId: id,
    codigo: null,
    titulo: "",
    variacao: null,
    ...extra,
  });

  it("casa pelo código, sem diferenciar maiúscula", () => {
    const [r] = sugerirVinculos([anuncio("t1", { codigo: "can-az", titulo: "Outro nome" })], skus);
    expect(r).toEqual({ skuExternoId: "t1", skuId: "s1", motivo: "codigo" });
  });

  it("sem código, casa por nome e variação, ignorando acento", () => {
    const [r] = sugerirVinculos([anuncio("t2", { titulo: "Bólsa  lona" })], skus);
    expect(r.skuId).toBe("s3");
    expect(r.motivo).toBe("nome");
  });

  it("não chuta quando há dois produtos da Pólia com o mesmo nome", () => {
    const [r] = sugerirVinculos([anuncio("t3", { titulo: "Ecobag" })], skus);
    expect(r.skuId).toBeNull();
  });

  it("não usa a mesma variação para dois anúncios", () => {
    const r = sugerirVinculos(
      [
        anuncio("t4", { codigo: "CAN-RS" }),
        anuncio("t5", { titulo: "Caneca Gato", variacao: "Rosa" }),
      ],
      skus,
    );
    expect(r[0].skuId).toBe("s2");
    expect(r[1].skuId).toBeNull();
  });

  it("dois anúncios com o mesmo código ficam sem sugestão", () => {
    const r = sugerirVinculos(
      [anuncio("t6", { codigo: "CAN-AZ" }), anuncio("t7", { codigo: "CAN-AZ" })],
      skus,
    );
    expect(r.map((x) => x.skuId)).toEqual([null, null]);
  });
});

describe("anúncios do TikTok", () => {
  it("vira uma linha por variação, com preço, quantidade somada e nome da variação", () => {
    const linhas = anunciosDoProduto({
      id: "p1",
      title: " Caneca Gato ",
      status: "ACTIVATE",
      skus: [
        {
          id: "s1",
          seller_sku: "CAN-AZ",
          price: { sale_price: "39.90", currency: "BRL" },
          inventory: [{ quantity: 3 }, { quantity: 2 }],
          sales_attributes: [
            { name: "Cor", value_name: "Azul" },
            { name: "Tamanho", value_name: "350ml" },
          ],
        },
        { id: "s2", price: { tax_exclusive_price: "x" } },
        { seller_sku: "sem-id" },
      ],
    });
    expect(linhas).toEqual([
      {
        produtoExternoId: "p1",
        skuExternoId: "s1",
        codigo: "CAN-AZ",
        titulo: "Caneca Gato",
        variacao: "Azul / 350ml",
        preco: 39.9,
        quantidade: 5,
        status: "ACTIVATE",
      },
      {
        produtoExternoId: "p1",
        skuExternoId: "s2",
        codigo: null,
        titulo: "Caneca Gato",
        variacao: null,
        preco: null,
        quantidade: 0,
        status: "ACTIVATE",
      },
    ]);
  });

  it("produto sem id não vira linha", () => {
    expect(anunciosDoProduto({ title: "x", skus: [{ id: "s" }] })).toEqual([]);
  });

  it("pede o detalhe só quando há várias variações sem nome", () => {
    expect(precisaDetalhe({ skus: [{ id: "a" }] })).toBe(false);
    expect(precisaDetalhe({ skus: [{ id: "a" }, { id: "b" }] })).toBe(true);
    expect(
      precisaDetalhe({
        skus: [
          { id: "a", sales_attributes: [{ value_name: "P" }] },
          { id: "b", sales_attributes: [{ value_name: "M" }] },
        ],
      }),
    ).toBe(false);
  });
});

describe("pedido do TikTok → venda", () => {
  const vinculos = new Map([["sk-az", "polia-az"]]);

  it("agrupa unidades do mesmo SKU e tira o desconto que a vendedora deu", () => {
    const itens = itensDoPedido(
      {
        line_items: [
          {
            sku_id: "sk-az",
            product_name: "Caneca Gato",
            sku_name: "Azul",
            original_price: "39.90",
            seller_discount: "5",
          },
          {
            sku_id: "sk-az",
            product_name: "Caneca Gato",
            sku_name: "Azul",
            original_price: "39.90",
            seller_discount: "5",
          },
          { sku_id: "sk-x", product_name: "Ecobag", original_price: "20", sale_price: "15" },
        ],
      },
      vinculos,
    );
    expect(itens).toEqual([
      {
        sku_id: "polia-az",
        nome: "Caneca Gato",
        variacao: "Azul",
        quantidade: 2,
        preco_unitario: 34.9,
      },
      { sku_id: null, nome: "Ecobag", variacao: null, quantidade: 1, preco_unitario: 20 },
    ]);
  });

  it("usa a quantidade quando a linha traz", () => {
    const [i] = itensDoPedido(
      { line_items: [{ sku_id: "sk-az", original_price: "10", quantity: 3 }] },
      vinculos,
    );
    expect(i.quantidade).toBe(3);
  });

  it("data no horário de Brasília", () => {
    // 2026-10-25 01:30 UTC = 24/10 22:30 em Brasília
    expect(dataDoPedido(Date.UTC(2026, 9, 25, 1, 30) / 1000)).toBe("2026-10-24");
  });

  it("taxa estimada bate com a taxaDaVenda da tela", () => {
    const regras = [
      { percentual: 3.19, fixo: 0.5 },
      { percentual: 12, fixo: 4 },
      { percentual: 0, fixo: 2 },
    ];
    for (const r of regras)
      for (const total of [1, 50, 39.9, 129.75])
        expect(taxaEstimada(total, r)).toBe(taxaDaVenda(total, r));
    expect(taxaEstimada(10, null)).toBe(0);
  });

  it("webhook: só o aviso de status de pedido", () => {
    expect(pedidoDoWebhook({ type: 1, shop_id: "7000", data: { order_id: 5770 } })).toEqual({
      shopId: "7000",
      pedidoId: "5770",
    });
    expect(pedidoDoWebhook({ type: 6, shop_id: "7000", data: {} })).toBeNull();
    expect(pedidoDoWebhook({ type: 1, data: { order_id: "1" } })).toBeNull();
    expect(pedidoDoWebhook("x")).toBeNull();
  });
});

describe("estoque Pólia → TikTok", () => {
  it("manda o saldo, com o depósito de cada SKU; negativo vira zero", () => {
    const depositos = depositosDoProduto({
      skus: [
        { id: "s1", inventory: [{ quantity: 3, warehouse_id: "W1" }] },
        { id: "s2", inventory: [{ quantity: 1 }] },
      ],
    });
    expect(depositos).toEqual(new Map([["s1", "W1"]]));
    expect(
      corpoAtualizarEstoque(
        [
          { skuExternoId: "s1", saldo: 4 },
          { skuExternoId: "s2", saldo: -2 },
          { skuExternoId: "s3", saldo: 2.7 },
        ],
        depositos,
      ),
    ).toEqual({
      skus: [
        { id: "s1", inventory: [{ warehouse_id: "W1", quantity: 4 }] },
        { id: "s2", inventory: [{ quantity: 0 }] },
        { id: "s3", inventory: [{ quantity: 2 }] },
      ],
    });
  });
});
