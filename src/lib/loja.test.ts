import { describe, expect, it } from "vitest";
import {
  configLojaSchema,
  linhaDaConfig,
  mensagemDoPedido,
  observacaoDoPedidoLoja,
  reais,
  type ConfigLoja,
} from "./loja";

const configBase: ConfigLoja = {
  slug: "loveless-crochet",
  ativo: true,
  prazoDiasUteis: 5,
  sinalPercentual: 50,
  pedeEndereco: true,
};

describe("reais", () => {
  it("escreve inteiro sem centavos e quebrado com duas casas", () => {
    expect(reais(189)).toBe("R$ 189");
    expect(reais(144.5)).toBe("R$ 144,50");
    expect(reais(0)).toBe("R$ 0");
  });
  it("separa milhar com ponto", () => {
    expect(reais(1234.5)).toBe("R$ 1.234,50");
    expect(reais(2000)).toBe("R$ 2.000");
  });
});

describe("observacaoDoPedidoLoja", () => {
  it("junta endereço, presente e observação depois do aviso da loja", () => {
    const o = observacaoDoPedidoLoja({ endereco: "Rua A, 10", presentePara: "Bia", observacao: "Sem pressa" });
    expect(o).toBe(
      "Pedido pela loja da Pólia One. Endereço: Rua A, 10. Presente para Bia. Observação da cliente: Sem pressa",
    );
  });
  it("sem nada, fica só o aviso", () => {
    expect(observacaoDoPedidoLoja({})).toBe("Pedido pela loja da Pólia One.");
  });
  it("nunca passa de 500 caracteres (o teto de vendas.observacao)", () => {
    const o = observacaoDoPedidoLoja({
      endereco: "x".repeat(300),
      presentePara: "y".repeat(120),
      observacao: "z".repeat(400),
    });
    expect(o.length).toBeLessThanOrEqual(500);
    expect(o.endsWith("…")).toBe(true);
  });
});

describe("mensagemDoPedido", () => {
  const itens = [
    { nome: "Bolsa Lua", variacao: "Rosa", quantidade: 2, preco: 189 },
    { nome: "Chaveiro", variacao: null, quantidade: 1, preco: 30.5 },
  ];
  const dados = { nome: "Ana Souza", whatsapp: "(11) 98888-0000" };

  it("lista itens com e sem variação e fecha o total", () => {
    const m = mensagemDoPedido({ nome: "Loveless", sinalPercentual: 0 }, itens, dados);
    expect(m).toContain("*Pedido pela loja da Loveless*");
    expect(m).toContain("Nome: Ana Souza");
    expect(m).toContain("WhatsApp: (11) 98888-0000");
    expect(m).toContain("- Bolsa Lua, Rosa x2: R$ 378");
    expect(m).toContain("- Chaveiro x1: R$ 30,50");
    expect(m).toContain("*Total: R$ 408,50*");
  });
  it("sem sinal, não fala de sinal", () => {
    const m = mensagemDoPedido({ nome: "Loveless", sinalPercentual: 0 }, itens, dados);
    expect(m).not.toContain("Sinal");
  });
  it("com sinal, mostra o valor pra começar", () => {
    const m = mensagemDoPedido({ nome: "Loveless", sinalPercentual: 50 }, itens, dados);
    expect(m).toContain("Sinal de 50% pra começar: R$ 204,25");
  });
  it("endereço, presente e observação entram só quando existem", () => {
    const sem = mensagemDoPedido({ nome: "L", sinalPercentual: 0 }, itens, dados);
    expect(sem).not.toContain("Endereço");
    expect(sem).not.toContain("Presente");
    expect(sem).not.toContain("Observações");
    const com = mensagemDoPedido({ nome: "L", sinalPercentual: 0 }, itens, {
      ...dados,
      endereco: "Rua A, 10",
      presentePara: "Bia",
      observacao: "Embrulhar",
    });
    expect(com).toContain("Endereço: Rua A, 10");
    expect(com).toContain("Presente para: Bia");
    expect(com).toContain("Observações: Embrulhar");
  });
});

describe("linhaDaConfig", () => {
  it("vazio e só espaço viram null", () => {
    const l = linhaDaConfig({ ...configBase, chamada: "", subchamada: "   ", corDestaque: "", entregaTexto: "", aviso: "" });
    expect(l.chamada).toBeNull();
    expect(l.subchamada).toBeNull();
    expect(l.cor_destaque).toBeNull();
    expect(l.entrega_texto).toBeNull();
    expect(l.aviso).toBeNull();
    expect(l.instagram).toBeNull();
    expect(l.whatsapp).toBeNull();
  });
  it("normaliza o WhatsApp e deixa null o que não é número válido", () => {
    expect(linhaDaConfig({ ...configBase, whatsapp: "(11) 98888-0000" }).whatsapp).toBe("5511988880000");
    expect(linhaDaConfig({ ...configBase, whatsapp: "123" }).whatsapp).toBeNull();
  });
  it("mantém o texto preenchido, sem espaço nas pontas", () => {
    const l = linhaDaConfig({ ...configBase, chamada: "  Bolsas de crochê  ", corDestaque: "#C8387F" });
    expect(l.chamada).toBe("Bolsas de crochê");
    expect(l.cor_destaque).toBe("#C8387F");
    expect(l.prazo_dias_uteis).toBe(5);
    expect(l.sinal_percentual).toBe(50);
    expect(l.pede_endereco).toBe(true);
  });
});

describe("configLojaSchema", () => {
  it("tira o @ do Instagram", () => {
    const r = configLojaSchema.parse({ ...configBase, instagram: "@loveless.crochet" });
    expect(r.instagram).toBe("loveless.crochet");
  });
  it("recusa Instagram com caractere estranho", () => {
    expect(configLojaSchema.safeParse({ ...configBase, instagram: "@loja com espaço" }).success).toBe(false);
  });
  it("passa o endereço pra minúsculas e aceita hífen", () => {
    expect(configLojaSchema.parse({ ...configBase, slug: " Loja-Da-Bia " }).slug).toBe("loja-da-bia");
  });
  it("recusa endereço curto, com espaço ou terminado em hífen", () => {
    for (const slug of ["ab", "loja da bia", "loja-", "-loja", "loja_bia", "x".repeat(41)]) {
      expect(configLojaSchema.safeParse({ ...configBase, slug }).success, slug).toBe(false);
    }
  });
  it("recusa cor que não é hex de 6 dígitos e aceita vazio", () => {
    expect(configLojaSchema.safeParse({ ...configBase, corDestaque: "rosa" }).success).toBe(false);
    expect(configLojaSchema.safeParse({ ...configBase, corDestaque: "" }).success).toBe(true);
  });
});
