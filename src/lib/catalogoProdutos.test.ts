import { describe, expect, it } from "vitest";
import {
  contagemDoCatalogo,
  controlaMateriais,
  direcaoInicial,
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
    arquivado: boolean;
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
  it("conta cada filtro; Todos soma ativos e inativos", () => {
    expect(contagemDoCatalogo(lista, 71)).toEqual({
      ativos: 3,
      vitrine: 2,
      fora: 1,
      sem_custo: 1,
      inativos: 71,
      todos: 74,
    });
  });
});

describe("filtrarCatalogo", () => {
  const inativos = [p("Teste", { created_at: "2026-10-01T00:00:00Z" })];
  it("separa Vitrine, fora da Vitrine, sem custo, inativos e todos", () => {
    expect(filtrarCatalogo(lista, inativos, "vitrine").map((x) => x.nome)).toEqual([
      "Caneca",
      "Azulejo",
    ]);
    expect(filtrarCatalogo(lista, inativos, "fora").map((x) => x.nome)).toEqual(["Babador"]);
    expect(filtrarCatalogo(lista, inativos, "sem_custo").map((x) => x.nome)).toEqual(["Babador"]);
    expect(filtrarCatalogo(lista, inativos, "inativos").map((x) => x.nome)).toEqual(["Teste"]);
    expect(filtrarCatalogo(lista, inativos, "ativos")).toHaveLength(3);
    expect(filtrarCatalogo(lista, inativos, "todos")).toHaveLength(4);
  });
});

describe("ordenarCatalogo", () => {
  const lucro = (x: (typeof lista)[number]) =>
    x.preco_custo == null
      ? null
      : Math.round(((x.preco_venda - x.preco_custo) / x.preco_venda) * 100);
  const nomes = (l: typeof lista) => l.map((x) => x.nome);

  it("mais recentes primeiro", () => {
    expect(nomes(ordenarCatalogo(lista, "recentes", "desc", lucro))).toEqual([
      "Azulejo",
      "Caneca",
      "Babador",
    ]);
  });

  it("por nome nas duas direções", () => {
    expect(nomes(ordenarCatalogo(lista, "nome", "asc", lucro))).toEqual([
      "Azulejo",
      "Babador",
      "Caneca",
    ]);
    expect(nomes(ordenarCatalogo(lista, "nome", "desc", lucro))).toEqual([
      "Caneca",
      "Babador",
      "Azulejo",
    ]);
  });

  it("preço, custo e lucro; sem custo fica no fim nas duas direções", () => {
    expect(nomes(ordenarCatalogo(lista, "preco", "desc", lucro))).toEqual([
      "Caneca",
      "Azulejo",
      "Babador",
    ]);
    // Mesmo custo: o nome desempata.
    expect(nomes(ordenarCatalogo(lista, "custo", "asc", lucro))).toEqual([
      "Azulejo",
      "Caneca",
      "Babador",
    ]);
    expect(nomes(ordenarCatalogo(lista, "lucro", "desc", lucro))).toEqual([
      "Caneca",
      "Azulejo",
      "Babador",
    ]);
    expect(nomes(ordenarCatalogo(lista, "lucro", "asc", lucro))).toEqual([
      "Azulejo",
      "Caneca",
      "Babador",
    ]);
  });

  it("status põe os ativos antes em asc", () => {
    const misto = [p("Inativo", { arquivado: true }), p("Ativo")];
    expect(nomes(ordenarCatalogo(misto, "status", "asc", lucro))).toEqual(["Ativo", "Inativo"]);
  });

  it("não mexe na lista original", () => {
    const antes = nomes(lista);
    ordenarCatalogo(lista, "nome", "asc", lucro);
    expect(nomes(lista)).toEqual(antes);
  });

  it("primeiro clique: texto de A a Z, número do maior pro menor", () => {
    expect(direcaoInicial("nome")).toBe("asc");
    expect(direcaoInicial("lucro")).toBe("desc");
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
