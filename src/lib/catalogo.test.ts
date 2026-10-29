import { describe, expect, it } from "vitest";
import {
  montarObservacao,
  normalizarDominio,
  normalizarWhatsapp,
  origemPermitida,
  pedidoCatalogoSchema,
} from "./catalogo";

const pedidoValido = {
  dominio: "lovelesscrochet.com.br",
  id: "6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f",
  itens: [{ nome: "Jenny", variacao: "cor 840 Preto", quantidade: 2, preco_unitario: 289 }],
  cliente: { nome: "Ana Souza", whatsapp: "(11) 97743-5996" },
  entrega: { tipo: "Envio", endereco: "Avenida Paulista, 1000 - Bela Vista - São Paulo/SP - CEP 01310-100" },
  observacao: "Misturar preto e branco",
  prazo_dias_uteis: 5,
};

describe("normalizarDominio", () => {
  it("tira protocolo, www, caminho e maiúscula", () => {
    expect(normalizarDominio("https://www.LovelessCrochet.com.br/jenny/")).toBe("lovelesscrochet.com.br");
    expect(normalizarDominio("lovelesscrochet.com.br")).toBe("lovelesscrochet.com.br");
  });
  it("recusa o que não é domínio", () => {
    expect(normalizarDominio("loveless")).toBeNull();
    expect(normalizarDominio("")).toBeNull();
    expect(normalizarDominio("javascript:alert(1)")).toBeNull();
    expect(normalizarDominio("a b.com")).toBeNull();
  });
});

describe("origemPermitida", () => {
  const d = "lovelesscrochet.com.br";
  it("aceita o domínio da loja, o www e a prévia da Pólia Lab", () => {
    expect(origemPermitida("https://lovelesscrochet.com.br", d)).toBe(true);
    expect(origemPermitida("https://www.lovelesscrochet.com.br", d)).toBe(true);
    expect(origemPermitida("https://loveless-crochet.usepolia.workers.dev", d)).toBe(true);
  });
  it("recusa outro site, http e origem vazia", () => {
    expect(origemPermitida("https://outraloja.com.br", d)).toBe(false);
    expect(origemPermitida("https://lovelesscrochet.com.br.golpe.com", d)).toBe(false);
    expect(origemPermitida("http://lovelesscrochet.com.br", d)).toBe(false);
    expect(origemPermitida("https://usepolia.workers.dev.golpe.com", d)).toBe(false);
    expect(origemPermitida(null, d)).toBe(false);
  });
});

describe("normalizarWhatsapp", () => {
  it("põe o 55 no número com DDD", () => {
    expect(normalizarWhatsapp("(11) 97743-5996")).toBe("5511977435996");
    expect(normalizarWhatsapp("5511977435996")).toBe("5511977435996");
    expect(normalizarWhatsapp("1133334444")).toBe("551133334444");
  });
  it("recusa número curto ou de fora", () => {
    expect(normalizarWhatsapp("97743-5996")).toBeNull();
    expect(normalizarWhatsapp("+1 415 555 0100")).toBeNull();
  });
});

describe("pedidoCatalogoSchema", () => {
  it("aceita o pedido que o catálogo manda", () => {
    expect(pedidoCatalogoSchema.safeParse(pedidoValido).success).toBe(true);
  });
  it("recusa pedido sem item, com quantidade zero ou com id fora do formato", () => {
    expect(pedidoCatalogoSchema.safeParse({ ...pedidoValido, itens: [] }).success).toBe(false);
    expect(
      pedidoCatalogoSchema.safeParse({ ...pedidoValido, itens: [{ ...pedidoValido.itens[0], quantidade: 0 }] }).success,
    ).toBe(false);
    expect(pedidoCatalogoSchema.safeParse({ ...pedidoValido, id: "<script>" }).success).toBe(false);
  });
  it("o campo-isca preenchido não passa", () => {
    expect(pedidoCatalogoSchema.safeParse({ ...pedidoValido, site: "spam" }).success).toBe(false);
  });
});

describe("montarObservacao", () => {
  it("junta entrega, endereço, presente e a observação da cliente", () => {
    const o = montarObservacao(pedidoCatalogoSchema.parse({ ...pedidoValido, entrega: { ...pedidoValido.entrega, presente_para: "Bia" } }));
    expect(o).toBe(
      "Pedido pelo catálogo online. Entrega: Envio. Endereço: Avenida Paulista, 1000 - Bela Vista - São Paulo/SP - CEP 01310-100. Presente para Bia. Observação da cliente: Misturar preto e branco",
    );
  });
  it("nunca passa de 500 caracteres", () => {
    const longo = pedidoCatalogoSchema.parse({
      ...pedidoValido,
      entrega: { tipo: "Envio", endereco: "x".repeat(300), presente_para: "y".repeat(120) },
      observacao: "z".repeat(400),
    });
    expect(montarObservacao(longo).length).toBeLessThanOrEqual(500);
  });
});
