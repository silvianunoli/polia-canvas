import { describe, expect, it } from "vitest";
import {
  contagemDoCatalogo,
  controlaMateriais,
  filtrarCatalogo,
  filtrarReceitas,
  mostraTipoNoCard,
  ordenarCatalogo,
} from "@/lib/catalogoProdutos";

const p = (
  nome: string,
  extra: Partial<{
    tipo: string;
    preco_venda: number;
    preco_custo: number | null;
    no_catalogo: boolean;
    created_at: string;
  }> = {},
) => ({
  nome,
  tipo: "fisico",
  preco_venda: 10,
  preco_custo: 5,
  no_catalogo: false,
  created_at: "2026-11-01T00:00:00Z",
  ...extra,
});

const lista = [
  p("Caneca", { no_catalogo: true, preco_venda: 54.9, created_at: "2026-11-10T00:00:00Z" }),
  p("Azulejo", { no_catalogo: true, preco_venda: 44.9, created_at: "2026-11-12T00:00:00Z" }),
  p("Babador", { preco_custo: null, preco_venda: 31.62, created_at: "2026-11-05T00:00:00Z" }),
];

describe("contagemDoCatalogo", () => {
  it("conta cada filtro, com os arquivados à parte", () => {
    expect(contagemDoCatalogo(lista, 71)).toEqual({
      todos: 3,
      vitrine: 2,
      fora: 1,
      sem_custo: 1,
      arquivados: 71,
    });
  });
});

describe("filtrarCatalogo", () => {
  it("separa Vitrine, fora da Vitrine e sem custo", () => {
    expect(filtrarCatalogo(lista, "vitrine").map((x) => x.nome)).toEqual(["Caneca", "Azulejo"]);
    expect(filtrarCatalogo(lista, "fora").map((x) => x.nome)).toEqual(["Babador"]);
    expect(filtrarCatalogo(lista, "sem_custo").map((x) => x.nome)).toEqual(["Babador"]);
    expect(filtrarCatalogo(lista, "todos")).toHaveLength(3);
  });
});

describe("ordenarCatalogo", () => {
  const lucro = (x: (typeof lista)[number]) =>
    x.preco_custo == null
      ? null
      : Math.round(((x.preco_venda - x.preco_custo) / x.preco_venda) * 100);

  it("mais recentes primeiro por padrão", () => {
    expect(ordenarCatalogo(lista, "recentes", lucro).map((x) => x.nome)).toEqual([
      "Azulejo",
      "Caneca",
      "Babador",
    ]);
  });

  it("por nome, preço e lucro (sem custo vai pro fim)", () => {
    expect(ordenarCatalogo(lista, "nome", lucro).map((x) => x.nome)).toEqual([
      "Azulejo",
      "Babador",
      "Caneca",
    ]);
    expect(ordenarCatalogo(lista, "preco", lucro).map((x) => x.nome)).toEqual([
      "Caneca",
      "Azulejo",
      "Babador",
    ]);
    expect(ordenarCatalogo(lista, "lucro", lucro).map((x) => x.nome)).toEqual([
      "Caneca",
      "Azulejo",
      "Babador",
    ]);
  });

  it("não mexe na lista original", () => {
    const antes = lista.map((x) => x.nome);
    ordenarCatalogo(lista, "nome", lucro);
    expect(lista.map((x) => x.nome)).toEqual(antes);
  });
});

describe("mostraTipoNoCard", () => {
  it("some quando todos são do mesmo tipo", () => {
    expect(mostraTipoNoCard(lista)).toBe(false);
    expect(mostraTipoNoCard([...lista, p("Aula", { tipo: "servico" })])).toBe(true);
  });
});

describe("controlaMateriais", () => {
  it("só quando algum material tem saldo ou mínimo", () => {
    expect(controlaMateriais([{ saldo: 0, minimo: 0 }])).toBe(false);
    expect(
      controlaMateriais([
        { saldo: 0, minimo: 0 },
        { saldo: 3, minimo: 0 },
      ]),
    ).toBe(true);
    expect(controlaMateriais([{ saldo: 0, minimo: 2 }])).toBe(true);
    expect(controlaMateriais([{ saldo: -1, minimo: 0 }])).toBe(true);
  });
});

describe("filtrarReceitas", () => {
  it("separa quem tem e quem não tem receita", () => {
    const produtos = [{ id: "a" }, { id: "b" }];
    const tem = (id: string) => id === "a";
    expect(filtrarReceitas(produtos, tem, "com")).toEqual([{ id: "a" }]);
    expect(filtrarReceitas(produtos, tem, "sem")).toEqual([{ id: "b" }]);
    expect(filtrarReceitas(produtos, tem, "todas")).toHaveLength(2);
  });
});
