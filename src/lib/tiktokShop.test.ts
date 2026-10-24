import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  assinarChamada,
  statusVendaDoPedido,
  sugerirVinculos,
  textoDaAssinatura,
  urlDeAutorizacao,
  webhookAutentico,
  type AnuncioCanal,
  type SkuPolia,
} from "../../supabase/functions/_shared/tiktokShop.ts";

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
