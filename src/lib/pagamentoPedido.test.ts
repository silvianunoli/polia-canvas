import { describe, expect, it } from "vitest";
import {
  CANAIS_DO_PEDIDO,
  chaveDaTaxa,
  ehMarketplace,
  liquidoDoPedido,
  pagamentoVemDoCanal,
  rotuloDaTaxa,
  rotuloDoPagamento,
} from "@/lib/pagamentoPedido";

describe("pagamento do pedido", () => {
  it("Onde vendeu começa em Encomenda e tem Vitrine, Loja da marca e os três marketplaces", () => {
    expect(CANAIS_DO_PEDIDO[0]).toBe("encomenda");
    for (const c of ["catalogo", "site", "shopee", "tiktok_shop", "mercado_livre"]) {
      expect(CANAIS_DO_PEDIDO).toContain(c);
    }
  });

  it("marketplace usa a regra dele; o resto usa a da forma", () => {
    expect(chaveDaTaxa("shopee", "pix")).toBe("shopee");
    expect(chaveDaTaxa("mercado_livre", "")).toBe("mercado_livre");
    expect(chaveDaTaxa("catalogo", "credito_parcelado")).toBe("credito_parcelado");
    expect(chaveDaTaxa("encomenda", "")).toBeNull();
  });

  it("loja da marca e marketplace chegam prontos; Vitrine e encomenda escolhem", () => {
    expect(pagamentoVemDoCanal("site")).toBe(true);
    expect(pagamentoVemDoCanal("tiktok_shop")).toBe(true);
    expect(pagamentoVemDoCanal("catalogo")).toBe(false);
    expect(pagamentoVemDoCanal("encomenda")).toBe(false);
    expect(ehMarketplace("site")).toBe(false);
  });

  it("mostra o marketplace pelo nome, a loja com Mercado Pago e o vazio como A definir", () => {
    expect(rotuloDoPagamento("mercado_livre", null)).toBe("Mercado Livre");
    expect(rotuloDoPagamento("site", "credito_parcelado")).toBe("Crédito parcelado (Mercado Pago)");
    expect(rotuloDoPagamento("site", null)).toBe("Mercado Pago");
    expect(rotuloDoPagamento("catalogo", null)).toBe("A definir");
    expect(rotuloDoPagamento("encomenda", "pix")).toBe("Pix");
  });

  it("nomeia a taxa pelo canal", () => {
    expect(rotuloDaTaxa("shopee")).toBe("Taxa da Shopee");
    expect(rotuloDaTaxa("site")).toBe("Taxa do Mercado Pago");
    expect(rotuloDaTaxa("encomenda")).toBe("Taxa");
  });

  it("o que fica depois da taxa nunca é negativo", () => {
    expect(liquidoDoPedido(89.9, 12.4)).toBe(77.5);
    expect(liquidoDoPedido(10, 20)).toBe(0);
  });
});
