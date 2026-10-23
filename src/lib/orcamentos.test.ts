import { describe, expect, it } from "vitest";
import {
  mensagemWhatsApp,
  podeVirarVenda,
  situacaoDoOrcamento,
  somarDias,
  textoSobreCor,
  totaisDoOrcamento,
  usoDaCor,
  validarOrcamento,
} from "./orcamentos";

const item = (quantidade: number, preco_unitario: number, produto_nome = "Caneca") => ({
  produto_nome,
  quantidade,
  preco_unitario,
});

describe("totaisDoOrcamento", () => {
  it("bate com a conta do banco (3 x 59,90 + 120 - 10 + 15,50)", () => {
    expect(
      totaisDoOrcamento({ itens: [item(3, 59.9), item(1, 120)], desconto: 10, frete: 15.5 }),
    ).toEqual({ subtotal: 299.7, total: 305.2 });
  });
  it("total nunca fica negativo", () => {
    expect(totaisDoOrcamento({ itens: [item(1, 10)], desconto: 10, frete: 0 }).total).toBe(0);
  });
});

describe("situacaoDoOrcamento", () => {
  it("enviado com validade passada vira vencido; o resto fica igual", () => {
    expect(situacaoDoOrcamento({ status: "enviado", validade: "2026-10-22" }, "2026-10-23")).toBe(
      "vencido",
    );
    expect(situacaoDoOrcamento({ status: "enviado", validade: "2026-10-23" }, "2026-10-23")).toBe(
      "enviado",
    );
    expect(situacaoDoOrcamento({ status: "aprovado", validade: "2026-10-01" }, "2026-10-23")).toBe(
      "aprovado",
    );
  });
});

describe("podeVirarVenda", () => {
  it("só enviado ou aprovado", () => {
    expect(podeVirarVenda({ status: "enviado" })).toBe(true);
    expect(podeVirarVenda({ status: "aprovado" })).toBe(true);
    expect(podeVirarVenda({ status: "convertido" })).toBe(false);
    expect(podeVirarVenda({ status: "cancelado" })).toBe(false);
  });
});

describe("somarDias", () => {
  it("atravessa mês e ano", () => {
    expect(somarDias("2026-10-28", 7)).toBe("2026-11-04");
    expect(somarDias("2026-12-30", 7)).toBe("2027-01-06");
  });
});

describe("validarOrcamento", () => {
  const hoje = "2026-10-23";
  const base = { itens: [item(1, 10)], desconto: 0, frete: 0, validade: "2026-10-30" };
  it("aceita o básico", () => {
    expect(validarOrcamento(base, hoje)).toBeNull();
  });
  it("pega cada problema", () => {
    expect(validarOrcamento({ ...base, itens: [] }, hoje)).toBe("sem_itens");
    expect(validarOrcamento({ ...base, itens: [item(1, 10, " ")] }, hoje)).toBe("item_sem_produto");
    expect(validarOrcamento({ ...base, itens: [item(1.5, 10)] }, hoje)).toBe("quantidade_invalida");
    expect(validarOrcamento({ ...base, itens: [item(1, 10.005)] }, hoje)).toBe("preco_invalido");
    expect(validarOrcamento({ ...base, desconto: 11 }, hoje)).toBe("desconto_maior");
    expect(validarOrcamento({ ...base, frete: -1 }, hoje)).toBe("valor_negativo");
    expect(validarOrcamento({ ...base, validade: "2026-10-22" }, hoje)).toBe("validade_passada");
  });
});

describe("textoSobreCor", () => {
  it("tinta em cor clara, branco em cor escura", () => {
    expect(textoSobreCor("#FFC629")).toBe("escuro");
    expect(textoSobreCor("#F3B9A9")).toBe("escuro");
    expect(textoSobreCor("#24696B")).toBe("claro");
    expect(textoSobreCor("#0A0A0A")).toBe("claro");
    expect(textoSobreCor("lixo")).toBe("escuro");
  });
});

describe("mensagemWhatsApp", () => {
  it("cumprimenta pelo primeiro nome e leva o link", () => {
    expect(
      mensagemWhatsApp({ marca: "Ateliê Lua", numero: 12, clienteNome: "Ana Souza", link: "L" }),
    ).toBe(
      "Oi, Ana. Segue o orçamento nº 12 de Ateliê Lua: L\nPor ali dá pra ver os itens e aprovar.",
    );
    expect(mensagemWhatsApp({ marca: "M", numero: 1, clienteNome: null, link: "L" })).toMatch(
      /^Oi\. /,
    );
  });
  it("sem nome de marca não inventa um", () => {
    expect(mensagemWhatsApp({ marca: null, numero: 3, clienteNome: null, link: "L" })).toBe(
      "Oi. Segue o orçamento nº 3: L\nPor ali dá pra ver os itens e aprovar.",
    );
  });
});

describe("usoDaCor", () => {
  it("cor com bom contraste pinta o fundo; meio de escala vira faixa", () => {
    expect(usoDaCor("#24696B")).toEqual({ modo: "fundo", texto: "claro" });
    expect(usoDaCor("#FFC629")).toEqual({ modo: "fundo", texto: "escuro" });
    expect(usoDaCor("#777777").modo).toBe("faixa");
    expect(usoDaCor(null).modo).toBe("nenhum");
  });
});
