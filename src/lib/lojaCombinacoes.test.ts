import { describe, expect, it } from "vitest";
import {
  atualizarCombinacoes,
  combinarEixos,
  corpoParaSalvar,
  estadoDoBanco,
  novoEixo,
  problemaDasCombinacoes,
  separarValores,
  slugDaCategoria,
  type CombinacaoEditavel,
} from "./lojaCombinacoes";

const cor = novoEixo("Cor", "Azul, Verde");
const tamanho = novoEixo("Tamanho", "P, G");
const nova = (nome: string, extra: Partial<CombinacaoEditavel> = {}): CombinacaoEditavel => ({
  chave: nome.toLowerCase(),
  nome,
  opcoes: { Opção: nome },
  preco: "",
  fotoPath: null,
  inicial: "",
  ...extra,
});

describe("separarValores", () => {
  it("tira espaço, vazio e repetido, sem diferenciar maiúscula", () => {
    expect(separarValores(" Azul, verde,, AZUL ,")).toEqual(["Azul", "verde"]);
    expect(separarValores("")).toEqual([]);
  });
});

describe("combinarEixos", () => {
  it("cruza as opções na ordem digitada", () => {
    expect(combinarEixos([cor, tamanho]).map((c) => c.nome)).toEqual([
      "Azul / P",
      "Azul / G",
      "Verde / P",
      "Verde / G",
    ]);
    expect(combinarEixos([cor, tamanho])[1].opcoes).toEqual({ Cor: "Azul", Tamanho: "G" });
  });
  it("ignora opção sem nome ou sem valor", () => {
    expect(
      combinarEixos([cor, novoEixo("Tamanho", " , "), novoEixo("", "X")]).map((c) => c.nome),
    ).toEqual(["Azul", "Verde"]);
  });
  it("sem opção, sem combinação", () => {
    expect(combinarEixos([])).toEqual([]);
  });
});

describe("atualizarCombinacoes", () => {
  it("guarda id, preço, foto e quantidade de quem continua", () => {
    const antes = atualizarCombinacoes([cor], []).map((c) =>
      c.nome === "Azul" ? { ...c, id: "sku-1", preco: "99", fotoPath: "u/a.png", inicial: "3" } : c,
    );
    const depois = atualizarCombinacoes([novoEixo("Cor", "azul, Rosa")], antes);
    expect(depois[0]).toMatchObject({
      id: "sku-1",
      preco: "99",
      fotoPath: "u/a.png",
      inicial: "3",
      nome: "azul",
    });
    expect(depois[1]).toMatchObject({ nome: "Rosa", preco: "", fotoPath: null });
    expect(depois[1].id).toBeUndefined();
  });
  it("valor que saiu some da lista", () => {
    const antes = atualizarCombinacoes([cor], []);
    expect(atualizarCombinacoes([novoEixo("Cor", "Azul")], antes).map((c) => c.nome)).toEqual([
      "Azul",
    ]);
  });
});

describe("estadoDoBanco", () => {
  const sku = (id: string, variacao: string, opcoes: Record<string, string> | null = null) => ({
    id,
    variacao,
    opcoes,
    preco_venda: null,
    foto_path: null,
    saldo: 2,
  });
  it("produto sem variação fica sem opções", () => {
    expect(estadoDoBanco([], [])).toEqual({ eixos: [], combinacoes: [] });
  });
  it("monta eixos e combinações salvas", () => {
    const e = estadoDoBanco(
      ["Cor", "Tamanho"],
      [
        sku("a", "Azul / P", { Cor: "Azul", Tamanho: "P" }),
        sku("b", "Azul / G", { Cor: "Azul", Tamanho: "G" }),
      ],
    );
    expect(e.eixos.map((x) => [x.nome, x.valores])).toEqual([
      ["Cor", "Azul"],
      ["Tamanho", "P, G"],
    ]);
    expect(e.combinacoes[1]).toMatchObject({ id: "b", chave: "azul|g", saldo: 2 });
  });
  it("variação antiga em texto vira o eixo Opção, sem se perder", () => {
    const e = estadoDoBanco([], [sku("a", "azul"), sku("b", "verde")]);
    expect(e.eixos.map((x) => [x.nome, x.valores])).toEqual([["Opção", "azul, verde"]]);
    expect(e.combinacoes.map((c) => c.opcoes)).toEqual([{ Opção: "azul" }, { Opção: "verde" }]);
  });
  it("combinação antiga e nova convivem depois de recalcular", () => {
    const e = estadoDoBanco([], [sku("a", "azul")]);
    const depois = atualizarCombinacoes([{ ...e.eixos[0], valores: "azul, verde" }], e.combinacoes);
    expect(depois[0].id).toBe("a");
    expect(depois[1].id).toBeUndefined();
  });
});

describe("problemaDasCombinacoes", () => {
  it("aceita produto sem opção e opção completa", () => {
    expect(problemaDasCombinacoes([], [])).toBeNull();
    expect(problemaDasCombinacoes([novoEixo()], [])).toBeNull();
    expect(problemaDasCombinacoes([cor, tamanho], [nova("Azul / P")])).toBeNull();
  });
  it("recusa opção pela metade", () => {
    expect(problemaDasCombinacoes([novoEixo("", "Azul")], [])).toContain("nome");
    expect(problemaDasCombinacoes([novoEixo("Cor", "")], [])).toContain("valores");
  });
  it("recusa nome repetido", () => {
    expect(problemaDasCombinacoes([novoEixo("Cor", "A"), novoEixo("cor", "B")], [])).toContain(
      "mesmo nome",
    );
  });
  it("recusa mais de 200 combinações", () => {
    const muitos = Array.from({ length: 15 }, (_, i) => `v${i}`).join(",");
    expect(problemaDasCombinacoes([novoEixo("A", muitos), novoEixo("B", muitos)], [])).toContain(
      "225",
    );
  });
  it("recusa preço inválido, e vazio é permitido", () => {
    expect(problemaDasCombinacoes([cor], [nova("Azul", { preco: "-1" })])).toContain("preço");
    expect(problemaDasCombinacoes([cor], [nova("Azul", { preco: "abc" })])).toContain("preço");
    expect(problemaDasCombinacoes([cor], [nova("Azul", { preco: "" })])).toBeNull();
    expect(problemaDasCombinacoes([cor], [nova("Azul", { preco: "0" })])).toBeNull();
  });
});

describe("corpoParaSalvar", () => {
  it("combinação nova leva a quantidade; a que já existe, não", () => {
    const c = corpoParaSalvar(
      [cor],
      [nova("Azul", { inicial: "3" }), nova("Verde", { id: "x", inicial: "9", preco: "10.5" })],
      true,
      "",
    );
    expect(c.p_combinacoes[0]).toMatchObject({ id: null, inicial: 3, preco: null });
    expect(c.p_combinacoes[1]).toMatchObject({ id: "x", inicial: 0, preco: 10.5 });
    expect(c.p_eixos).toEqual(["Cor"]);
  });
  it("sob encomenda nunca manda quantidade", () => {
    const c = corpoParaSalvar([cor], [nova("Azul", { inicial: "3" })], false, "7");
    expect(c.p_combinacoes[0].inicial).toBe(0);
    expect(c.p_inicial_padrao).toBe(0);
    expect(c.p_controla).toBe(false);
  });
  it("produto sem variação manda a quantidade padrão", () => {
    const c = corpoParaSalvar([], [], true, "7");
    expect(c).toMatchObject({ p_eixos: [], p_combinacoes: [], p_inicial_padrao: 7 });
  });
});

describe("slugDaCategoria", () => {
  it("fica no formato que o banco aceita", () => {
    expect(slugDaCategoria(" Bolsas & Acessórios ")).toBe("bolsas-acessorios");
    expect(slugDaCategoria("!!!")).toBe("");
    expect(slugDaCategoria("a".repeat(59) + " b c")).toMatch(
      /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/,
    );
  });
});
