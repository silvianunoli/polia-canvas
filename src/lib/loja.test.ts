import { describe, expect, it } from "vitest";
import {
  configLojaSchema,
  linhaDaConfig,
  mensagemDoPedido,
  observacaoDoPedidoLoja,
  lerCoresColadas,
  opcoesDaPaleta,
  opcaoDasCores,
  opcaoDoItem,
  maxCoresValido,
  pedidoLojaSchema,
  problemaDaOrigemDoBanner,
  recorteDoBanner,
  produtosDaCategoria,
  reais,
  rotuloDaCor,
  temFiltroDeCategoria,
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

describe("categorias da vitrine", () => {
  const prod = (id: string, categoriaId: string | null) => ({ id, categoriaId });
  const bolsas = { id: "c1", nome: "Bolsas" };
  const chaveiros = { id: "c2", nome: "Chaveiros" };

  it("filtro só aparece quando separa alguma coisa", () => {
    expect(temFiltroDeCategoria({ categorias: [], produtos: [] })).toBe(false);
    expect(temFiltroDeCategoria({ categorias: [bolsas], produtos: [prod("a", "c1")] as never })).toBe(false);
    expect(temFiltroDeCategoria({ categorias: [bolsas], produtos: [prod("a", "c1"), prod("b", null)] as never })).toBe(true);
    expect(temFiltroDeCategoria({ categorias: [bolsas, chaveiros], produtos: [] })).toBe(true);
  });

  it("filtra pela categoria; null mostra todos", () => {
    const lista = [prod("a", "c1"), prod("b", "c2"), prod("c", null)];
    expect(produtosDaCategoria(lista, "c1").map((p) => p.id)).toEqual(["a"]);
    expect(produtosDaCategoria(lista, null)).toHaveLength(3);
  });
});

describe("paleta de cores", () => {
  const hibisco = { id: "c1", codigo: "812", nome: "Hibisco", hex: "#C84D69" };

  it("rótulo igual ao que o banco grava no pedido", () => {
    expect(rotuloDaCor(hibisco)).toBe("Cor 812 Hibisco");
    expect(rotuloDaCor({ codigo: null, nome: "Hibisco" })).toBe("Cor Hibisco");
  });

  it("cor da foto vem primeiro; sem paleta, nenhuma opção", () => {
    expect(opcoesDaPaleta([], "Preto")).toEqual([]);
    const ops = opcoesDaPaleta([hibisco], "Preto e branco");
    expect(ops.map((o) => o.id)).toEqual(["foto", "c1"]);
    expect(ops[0].nome).toBe("Cor da foto (Preto e branco)");
    expect(ops[1]).toEqual({ id: "c1", nome: "Cor 812 Hibisco", hex: "#C84D69" });
  });

  it("lê a lista colada, uma cor por linha", () => {
    const r = lerCoresColadas(
      ["801 Azul Bondi #6da9d2", "", "Verde Hortelã #A7D8C3", "#25304A Midnight", "sem cor aqui", "#FFFFFF"].join(String.fromCharCode(10)),
    );
    expect(r.cores).toEqual([
      { codigo: "801", nome: "Azul Bondi", hex: "#6DA9D2" },
      { codigo: null, nome: "Verde Hortelã", hex: "#A7D8C3" },
      { codigo: null, nome: "Midnight", hex: "#25304A" },
    ]);
    expect(r.ignoradas).toBe(2);
  });
});

describe("várias cores no mesmo produto (22/11/2026)", () => {
  const a = { id: "11111111-1111-4111-8111-111111111111", nome: "Cor 812 Hibisco", hex: "#B05468" };
  const b = { id: "22222222-2222-4222-8222-222222222222", nome: "Cor 806 Off White", hex: "#F1EFE7" };
  const c = { id: "33333333-3333-4333-8333-333333333333", nome: "Cor Azul", hex: "#6DA9D2" };
  const foto = { id: "foto", nome: "Cor da foto", hex: null };
  const produto = { usaPaleta: true, maxCores: 2, variacoes: [foto, a, b, c] };

  it("junta as cores na ordem, com o texto que o banco grava", () => {
    expect(opcaoDasCores(produto, [a.id, b.id])).toEqual({
      id: `${a.id}+${b.id}`,
      nome: "Cores 812 Hibisco + 806 Off White",
      hex: null,
    });
    expect(opcaoDasCores(produto, [b.id, a.id])?.nome).toBe("Cores 806 Off White + 812 Hibisco");
  });
  it("uma cor só é a própria opção", () => {
    expect(opcaoDasCores(produto, [a.id])).toEqual(a);
  });
  it("recusa acima do máximo, repetida, cor de fora e cor da foto no meio", () => {
    expect(opcaoDasCores(produto, [a.id, b.id, c.id])).toBeNull();
    expect(opcaoDasCores(produto, [a.id, a.id])).toBeNull();
    expect(opcaoDasCores(produto, [a.id, "44444444-4444-4444-8444-444444444444"])).toBeNull();
    expect(opcaoDasCores(produto, ["foto", a.id])).toBeNull();
    expect(opcaoDasCores({ ...produto, usaPaleta: false }, [a.id])).toBeNull();
  });
  it("lê de volta o que ficou guardado no carrinho", () => {
    expect(opcaoDoItem(produto, `${a.id}+${b.id}`)?.nome).toBe("Cores 812 Hibisco + 806 Off White");
    expect(opcaoDoItem(produto, "foto")).toEqual(foto);
    expect(opcaoDoItem({ ...produto, maxCores: 1 }, `${a.id}+${b.id}`)).toBeNull();
    expect(opcaoDoItem(produto, null)).toBeNull();
  });
  it("máximo de cores fica entre 1 e 3", () => {
    expect(maxCoresValido(2)).toBe(2);
    expect(maxCoresValido(9)).toBe(3);
    expect(maxCoresValido(0)).toBe(1);
    expect(maxCoresValido(null)).toBe(1);
  });
  it("o pedido aceita até 3 cores juntas e nada além", () => {
    const item = (skuId: string) => ({ produtoId: a.id, skuId, quantidade: 1 });
    const pedido = (skuId: string) =>
      pedidoLojaSchema.shape.itens.safeParse([item(skuId)]).success;
    expect(pedido(`${a.id}+${b.id}`)).toBe(true);
    expect(pedido(`${a.id}+${b.id}+${c.id}`)).toBe(true);
    expect(pedido(`${a.id}+${b.id}+${c.id}+${a.id}`)).toBe(false);
    expect(pedido(`${a.id}+foto`)).toBe(false);
  });
});

describe("recorte do banner (ONE-239)", () => {
  it("imagem larga anda na horizontal e mantém 8:3", () => {
    const r = recorteDoBanner(4000, 1000, 0);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 2667, sh: 1000, eixo: "horizontal" });
    expect(recorteDoBanner(4000, 1000, 1).sx).toBe(4000 - 2667);
  });

  it("foto em pé anda na vertical, centralizada no meio", () => {
    const r = recorteDoBanner(1200, 1600, 0.5);
    expect(r.eixo).toBe("vertical");
    expect(r.sw).toBe(1200);
    expect(r.sh).toBe(450);
    expect(r.sy).toBe(575);
  });

  it("imagem já em 8:3 não tem o que escolher", () => {
    expect(recorteDoBanner(1600, 600, 0.3)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 600, eixo: null });
  });

  it("posição fora de 0 a 1 fica na borda", () => {
    expect(recorteDoBanner(4000, 1000, 7).sx).toBe(4000 - 2667);
    expect(recorteDoBanner(4000, 1000, -2).sx).toBe(0);
  });

  it("aceita JPG, PNG e WEBP de até 15 MB", () => {
    expect(problemaDaOrigemDoBanner("image/webp", 1000)).toBeNull();
    expect(problemaDaOrigemDoBanner("image/gif", 1000)).toMatch(/JPG, PNG ou WEBP/);
    expect(problemaDaOrigemDoBanner("image/jpeg", 16 * 1024 * 1024)).toMatch(/15 MB/);
  });
});
