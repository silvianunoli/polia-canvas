import { describe, expect, it } from "vitest";
import type { ProdutoLoja } from "./loja";
import {
  COR_DESTAQUE_PADRAO,
  DADOS_VAZIOS,
  MAX_ITENS_CARRINHO,
  contraste,
  corDaLoja,
  coresDaVitrine,
  MAX_QUANTIDADE_ITEM,
  adicionarItem,
  assinaturaDoPedido,
  enderecoEmLinha,
  idDoPedido,
  limparCarrinho,
  linhasDoCarrinho,
  linkWhatsapp,
  mascararCep,
  mascararWhatsapp,
  mensagemDoErroPedido,
  montarPedido,
  primeiroNome,
  mudarQuantidade,
  resumoDoCarrinho,
  selosDaLoja,
  sinalDoPreco,
  validarCheckout,
  type DadosCheckout,
  type ItemCarrinho,
} from "./lojaVitrine";

const BOLSA = "11111111-1111-4111-8111-111111111111";
const CHAVEIRO = "22222222-2222-4222-8222-222222222222";
const ROSA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AZUL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const produtos: ProdutoLoja[] = [
  {
    id: BOLSA,
    nome: "Bolsa Lua",
    descricao: null,
    preco: 189,
    fotos: [],
    variacoes: [
      { id: ROSA, nome: "Rosa" },
      { id: AZUL, nome: "Azul" },
    ],
  },
  { id: CHAVEIRO, nome: "Chaveiro", descricao: null, preco: 30.5, fotos: [], variacoes: [] },
];

describe("limparCarrinho", () => {
  it("aceita só lista", () => {
    expect(limparCarrinho(null, produtos)).toEqual([]);
    expect(limparCarrinho({ a: 1 }, produtos)).toEqual([]);
    expect(limparCarrinho("x", produtos)).toEqual([]);
  });
  it("tira produto que saiu da loja e variação que sumiu", () => {
    const bruto = [
      { produtoId: "99999999-9999-4999-8999-999999999999", skuId: null, variacaoNome: null, quantidade: 1 },
      { produtoId: BOLSA, skuId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", variacaoNome: "Verde", quantidade: 1 },
      { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa", quantidade: 2 },
    ];
    expect(limparCarrinho(bruto, produtos)).toEqual([
      { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa", quantidade: 2 },
    ]);
  });
  it("tira item sem variação de produto que passou a ter variação, e vice-versa", () => {
    const bruto = [
      { produtoId: BOLSA, skuId: null, variacaoNome: null, quantidade: 1 },
      { produtoId: CHAVEIRO, skuId: ROSA, variacaoNome: "Rosa", quantidade: 1 },
    ];
    expect(limparCarrinho(bruto, produtos)).toEqual([]);
  });
  it("o nome da variação vem da loja, não do que estava guardado", () => {
    const bruto = [{ produtoId: BOLSA, skuId: AZUL, variacaoNome: "Azul antigo", quantidade: 1 }];
    expect(limparCarrinho(bruto, produtos)[0].variacaoNome).toBe("Azul");
  });
  it("junta repetido, descarta quantidade inválida e prende no teto", () => {
    const bruto = [
      { produtoId: CHAVEIRO, skuId: null, quantidade: 2 },
      { produtoId: CHAVEIRO, skuId: null, quantidade: 3 },
      { produtoId: BOLSA, skuId: ROSA, quantidade: 0 },
      { produtoId: BOLSA, skuId: AZUL, quantidade: "abc" },
      { produtoId: BOLSA, skuId: ROSA, quantidade: 5000 },
    ];
    expect(limparCarrinho(bruto, produtos)).toEqual([
      { produtoId: CHAVEIRO, skuId: null, variacaoNome: null, quantidade: 5 },
      { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa", quantidade: MAX_QUANTIDADE_ITEM },
    ]);
  });
});

describe("adicionarItem e mudarQuantidade", () => {
  it("soma quando é o mesmo produto e a mesma variação", () => {
    let itens: ItemCarrinho[] = [];
    itens = adicionarItem(itens, { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa" });
    itens = adicionarItem(itens, { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa" });
    itens = adicionarItem(itens, { produtoId: BOLSA, skuId: AZUL, variacaoNome: "Azul" });
    expect(itens).toEqual([
      { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa", quantidade: 2 },
      { produtoId: BOLSA, skuId: AZUL, variacaoNome: "Azul", quantidade: 1 },
    ]);
  });
  it("não passa do teto de itens", () => {
    const cheio: ItemCarrinho[] = Array.from({ length: MAX_ITENS_CARRINHO }, (_, k) => ({
      produtoId: `p${k}`,
      skuId: null,
      variacaoNome: null,
      quantidade: 1,
    }));
    expect(adicionarItem(cheio, { produtoId: CHAVEIRO, skuId: null, variacaoNome: null })).toHaveLength(
      MAX_ITENS_CARRINHO,
    );
  });
  it("zero tira o item; o resto muda a quantidade", () => {
    const itens: ItemCarrinho[] = [
      { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa", quantidade: 2 },
      { produtoId: CHAVEIRO, skuId: null, variacaoNome: null, quantidade: 1 },
    ];
    expect(mudarQuantidade(itens, 0, 3)[0].quantidade).toBe(3);
    expect(mudarQuantidade(itens, 1, 0)).toHaveLength(1);
  });
});

describe("linhas e resumo", () => {
  const itens: ItemCarrinho[] = [
    { produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa", quantidade: 2 },
    { produtoId: CHAVEIRO, skuId: null, variacaoNome: null, quantidade: 1 },
    { produtoId: "sumiu", skuId: null, variacaoNome: null, quantidade: 4 },
  ];
  it("preço sai da loja carregada e quem não existe fica de fora", () => {
    const linhas = linhasDoCarrinho(itens, produtos);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].total).toBe(378);
  });
  it("soma quantidade, subtotal e sinal", () => {
    const linhas = linhasDoCarrinho(itens, produtos);
    expect(resumoDoCarrinho(linhas, 50)).toEqual({ quantidade: 3, subtotal: 408.5, sinal: 204.25 });
    expect(resumoDoCarrinho(linhas, 0).sinal).toBe(0);
    expect(resumoDoCarrinho([], 30)).toEqual({ quantidade: 0, subtotal: 0, sinal: 0 });
  });
  it("sinal de um produto só", () => {
    expect(sinalDoPreco(189, 50)).toBe(94.5);
    expect(sinalDoPreco(100, 0)).toBe(0);
    expect(sinalDoPreco(99.99, 33)).toBe(33);
  });
});

describe("selosDaLoja", () => {
  it("só o prazo quando o resto está vazio", () => {
    const s = selosDaLoja({ prazoDiasUteis: 1, sinalPercentual: 0, entregaTexto: null, whatsapp: null });
    expect(s.map((x) => x.titulo)).toEqual(["Pronto em 1 dia útil"]);
  });
  it("prazo, sinal, entrega e WhatsApp quando configurados", () => {
    const s = selosDaLoja({ prazoDiasUteis: 5, sinalPercentual: 50, entregaTexto: " Correios ou retirada ", whatsapp: "5511988880000" });
    expect(s.map((x) => x.titulo)).toEqual([
      "Pronto em 5 dias úteis",
      "Sinal de 50%",
      "Entrega",
      "Pedido direto pelo WhatsApp",
    ]);
    expect(s[2].texto).toBe("Correios ou retirada");
  });
});

describe("máscaras", () => {
  it("WhatsApp enquanto digita e colado com +55", () => {
    expect(mascararWhatsapp("")).toBe("");
    expect(mascararWhatsapp("1")).toBe("(1");
    expect(mascararWhatsapp("1198")).toBe("(11) 98");
    expect(mascararWhatsapp("1133334444")).toBe("(11) 3333-4444");
    expect(mascararWhatsapp("11988880000")).toBe("(11) 98888-0000");
    expect(mascararWhatsapp("+55 11 98888-0000")).toBe("(11) 98888-0000");
    expect(mascararWhatsapp("119888800001234")).toBe("(11) 98888-0000");
  });
  it("CEP", () => {
    expect(mascararCep("01310")).toBe("01310");
    expect(mascararCep("01310100")).toBe("01310-100");
    expect(mascararCep("01310-1009")).toBe("01310-100");
  });
});

const dadosOk: DadosCheckout = {
  ...DADOS_VAZIOS,
  nome: "Ana Souza",
  whatsapp: "(11) 98888-0000",
  cep: "01310-100",
  rua: "Av. Paulista",
  numero: "1000",
  complemento: "ap 12",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "sp",
};

describe("validarCheckout", () => {
  it("nome e WhatsApp sempre", () => {
    expect(Object.keys(validarCheckout(DADOS_VAZIOS, false))).toEqual(["nome", "whatsapp"]);
  });
  it("endereço só quando a loja pede", () => {
    const so = { ...DADOS_VAZIOS, nome: "Ana", whatsapp: "11988880000" };
    expect(validarCheckout(so, false)).toEqual({});
    expect(Object.keys(validarCheckout(so, true))).toEqual(["cep", "rua", "numero", "cidade", "uf"]);
    expect(validarCheckout(dadosOk, true)).toEqual({});
  });
  it("presente pede o nome de quem recebe", () => {
    expect(validarCheckout({ ...dadosOk, presente: true }, true)).toHaveProperty("presentePara");
    expect(validarCheckout({ ...dadosOk, presente: true, presentePara: "Bia" }, true)).toEqual({});
  });
});

describe("pedido", () => {
  it("endereço numa linha, só quando a loja pede", () => {
    expect(enderecoEmLinha(dadosOk, true)).toBe(
      "Av. Paulista, 1000, ap 12 - Bela Vista - São Paulo/SP - CEP 01310-100",
    );
    expect(enderecoEmLinha(dadosOk, false)).toBeUndefined();
    expect(enderecoEmLinha({ ...dadosOk, rua: "x".repeat(400) }, true)!.length).toBe(300);
  });
  it("monta o corpo sem preço, com presente e observação só quando preenchidos", () => {
    const itens: ItemCarrinho[] = [{ produtoId: BOLSA, skuId: ROSA, variacaoNome: "Rosa", quantidade: 2 }];
    const p = montarPedido("loveless", itens, { ...dadosOk, presentePara: "Bia" }, false);
    expect(p).toEqual({
      slug: "loveless",
      itens: [{ produtoId: BOLSA, skuId: ROSA, quantidade: 2 }],
      cliente: { nome: "Ana Souza", whatsapp: "(11) 98888-0000" },
      endereco: undefined,
      presentePara: undefined,
      observacao: undefined,
    });
    const q = montarPedido("loveless", itens, { ...dadosOk, presente: true, presentePara: " Bia ", observacao: "x".repeat(450) }, true);
    expect(q.presentePara).toBe("Bia");
    expect(q.observacao).toHaveLength(400);
    expect(q.endereco).toContain("CEP 01310-100");
  });
  it("mesmo carrinho e mesmos dados mantêm o id; qualquer mudança gera outro", () => {
    const itens: ItemCarrinho[] = [{ produtoId: CHAVEIRO, skuId: null, variacaoNome: null, quantidade: 1 }];
    const a = assinaturaDoPedido(montarPedido("l", itens, dadosOk, true));
    const b = assinaturaDoPedido(montarPedido("l", itens, dadosOk, true));
    const c = assinaturaDoPedido(montarPedido("l", [{ ...itens[0], quantidade: 2 }], dadosOk, true));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    let n = 0;
    const novo = () => `pedido-${++n}-xxxxxxxx`;
    const p1 = idDoPedido(null, a, novo);
    const p2 = idDoPedido(p1, b, novo);
    const p3 = idDoPedido(p2, c, novo);
    expect(p2.id).toBe(p1.id);
    expect(p3.id).not.toBe(p1.id);
  });
  it("id guardado fora do formato vira um novo", () => {
    const p = idDoPedido({ assinatura: "x", id: "curto" }, "x", () => "novo-id-123456");
    expect(p.id).toBe("novo-id-123456");
  });
});

describe("cores da vitrine", () => {
  it("sem cor ou com cor inválida, usa o rosa padrão", () => {
    expect(corDaLoja(null)).toBe(COR_DESTAQUE_PADRAO);
    expect(corDaLoja("rosa")).toBe(COR_DESTAQUE_PADRAO);
    expect(corDaLoja("#7ccbcd")).toBe("#7CCBCD");
  });
  it("o que vira texto passa AA contra o fundo, mesmo com cor clara", () => {
    for (const cor of ["#C8387F", "#FFD54F", "#A7D8C3", "#FFFFFF", "#141414", "#1F3A93"]) {
      const c = coresDaVitrine(cor);
      expect(contraste(c.destaqueTexto, "#F6F3EF"), cor).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.destaqueClaro, "#141414"), cor).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("cor escura já passa e fica igual", () => {
    expect(coresDaVitrine("#1F3A93").destaqueTexto).toBe("#1F3A93");
  });
  it("texto em cima do destaque escolhe branco ou tinta pelo contraste", () => {
    expect(coresDaVitrine("#1F3A93").destaqueSobre).toBe("#FFFFFF");
    expect(coresDaVitrine("#FFD54F").destaqueSobre).toBe("#141414");
  });
});

describe("mensagemDoErroPedido", () => {
  it("cada motivo tem frase própria e o desconhecido cai no genérico", () => {
    const motivos = ["turnstile", "whatsapp", "indisponivel", "invalido", "limite"] as const;
    const frases = motivos.map((m) => mensagemDoErroPedido(m));
    expect(new Set(frases).size).toBe(motivos.length);
    expect(mensagemDoErroPedido("erro")).toBe(mensagemDoErroPedido("rede"));
    for (const f of [...frases, mensagemDoErroPedido("erro")]) expect(f).not.toMatch(/[!—–]/);
  });
  it("primeiro nome", () => {
    expect(primeiroNome("  Ana Maria Souza ")).toBe("Ana");
  });
});

describe("linkWhatsapp", () => {
  it("monta o wa.me com o texto codificado", () => {
    expect(linkWhatsapp("5511988880000", "Oi, tudo bem?")).toBe(
      "https://wa.me/5511988880000?text=Oi%2C%20tudo%20bem%3F",
    );
  });
  it("sem número, sem link", () => {
    expect(linkWhatsapp(null, "x")).toBeNull();
    expect(linkWhatsapp("123", "x")).toBeNull();
  });
});
