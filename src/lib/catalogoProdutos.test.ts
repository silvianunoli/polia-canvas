import { describe, expect, it } from "vitest";
import {
  contagemDoCatalogo,
  controlaMateriais,
  direcaoInicial,
  filtrarCatalogo,
  filtrarReceitas,
  lerOrdemDigitada,
  mostraTipoNoCard,
  compararOrdemDaVitrine,
  alvosDaAcao,
  contaProdutos,
  ordenarCatalogo,
  reposicionar,
} from "@/lib/catalogoProdutos";

const p = (
  nome: string,
  extra: Partial<{
    tipo: string;
    preco_venda: number;
    preco_custo: number | null;
    no_catalogo: boolean;
    arquivado: boolean;
    catalogo_ordem: number | null;
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

describe("ordem digitada (coluna Ordem)", () => {
  const comOrdem = [
    p("Velho sem número", { created_at: "2026-11-01T00:00:00Z" }),
    p("Segundo", { catalogo_ordem: 2 }),
    p("Novo sem número", { created_at: "2026-11-20T00:00:00Z" }),
    p("Primeiro", { catalogo_ordem: 1 }),
  ];

  it("numerados primeiro, pelo número; o resto do cadastro mais recente pro mais antigo", () => {
    expect(ordenarCatalogo(comOrdem, "ordem", "asc", () => null).map((x) => x.nome)).toEqual([
      "Primeiro",
      "Segundo",
      "Novo sem número",
      "Velho sem número",
    ]);
  });

  it("invertida, os numerados invertem e os sem número continuam no fim", () => {
    expect(ordenarCatalogo(comOrdem, "ordem", "desc", () => null).map((x) => x.nome)).toEqual([
      "Segundo",
      "Primeiro",
      "Novo sem número",
      "Velho sem número",
    ]);
  });

  it("a coluna Ordem começa do 1 pra cima", () => {
    expect(direcaoInicial("ordem")).toBe("asc");
  });

  it("número livre: só o produto muda", () => {
    expect(
      reposicionar(
        [
          { id: "a", ordem: 1 },
          { id: "b", ordem: null },
        ],
        "b",
        5,
      ),
    ).toEqual([{ id: "b", ordem: 5 }]);
  });

  it("número ocupado: quem está encostado desce um, até o primeiro buraco", () => {
    const lista2 = [
      { id: "a", ordem: 3 },
      { id: "b", ordem: 4 },
      { id: "c", ordem: 6 },
      { id: "x", ordem: null },
    ];
    expect(reposicionar(lista2, "x", 3)).toEqual([
      { id: "x", ordem: 3 },
      { id: "a", ordem: 4 },
      { id: "b", ordem: 5 },
    ]);
  });

  it("mudar de lugar não empurra a si mesmo", () => {
    expect(
      reposicionar(
        [
          { id: "a", ordem: 2 },
          { id: "b", ordem: 3 },
        ],
        "a",
        3,
      ),
    ).toEqual([
      { id: "a", ordem: 3 },
      { id: "b", ordem: 4 },
    ]);
  });

  it("vazio tira o número", () => {
    expect(reposicionar([{ id: "a", ordem: 2 }], "a", null)).toEqual([{ id: "a", ordem: null }]);
  });

  it("lê o campo: inteiro de 1 a 9999, vazio = sem número", () => {
    expect(lerOrdemDigitada(" 7 ")).toBe(7);
    expect(lerOrdemDigitada("")).toBeNull();
    expect(lerOrdemDigitada("0")).toBe("invalido");
    expect(lerOrdemDigitada("2,5")).toBe("invalido");
    expect(lerOrdemDigitada("10000")).toBe("invalido");
  });
});

describe("ordem da vitrine com desempate (ONE-239)", () => {
  const mesmaHora = "2026-11-10T12:00:00Z";
  it("numerados primeiro, depois o cadastro mais recente", () => {
    const lista = [
      { id: "a", nome: "Velho", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", nome: "Dois", catalogo_ordem: 2, created_at: "2026-01-01T00:00:00Z" },
      { id: "c", nome: "Novo", created_at: "2026-06-01T00:00:00Z" },
      { id: "d", nome: "Um", catalogo_ordem: 1, created_at: "2026-01-01T00:00:00Z" },
    ];
    expect([...lista].sort(compararOrdemDaVitrine).map((p) => p.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("importados juntos saem pelo nome, sem depender da ordem que chegaram", () => {
    const lista = [
      { id: "1", nome: "Mouse pad redondo", created_at: mesmaHora },
      { id: "2", nome: "Almofada linda", created_at: mesmaHora },
      { id: "3", nome: "caneca imperial", created_at: mesmaHora },
    ];
    const ida = [...lista].sort(compararOrdemDaVitrine).map((p) => p.nome);
    const volta = [...lista]
      .reverse()
      .sort(compararOrdemDaVitrine)
      .map((p) => p.nome);
    expect(ida).toEqual(["Almofada linda", "caneca imperial", "Mouse pad redondo"]);
    expect(volta).toEqual(ida);
  });

  it("mesmo nome e mesma hora: o id decide", () => {
    const lista = [
      { id: "z", nome: "Caneca", created_at: mesmaHora },
      { id: "b", nome: "Caneca", created_at: mesmaHora },
    ];
    expect([...lista].sort(compararOrdemDaVitrine).map((p) => p.id)).toEqual(["b", "z"]);
  });
});

describe("alvosDaAcao", () => {
  const ativoNaVitrine = p("A", { no_catalogo: true });
  const ativoFora = p("B", { no_catalogo: false });
  const inativoLigado = p("C", { arquivado: true, no_catalogo: true });
  const inativoFora = p("D", { arquivado: true, no_catalogo: false });
  const todos = [ativoNaVitrine, ativoFora, inativoLigado, inativoFora];
  const nomes = (l: { nome: string }[]) => l.map((x) => x.nome);

  it("ativar pega só os inativos", () => {
    expect(nomes(alvosDaAcao(todos, "ativar"))).toEqual(["C", "D"]);
  });
  it("inativar pega só os ativos", () => {
    expect(nomes(alvosDaAcao(todos, "inativar"))).toEqual(["A", "B"]);
  });
  it("ligar na Vitrine pega só ativo que está fora", () => {
    expect(nomes(alvosDaAcao(todos, "vitrine_ligar"))).toEqual(["B"]);
  });
  it("desligar da Vitrine pega todo ligado, até o inativo", () => {
    expect(nomes(alvosDaAcao(todos, "vitrine_desligar"))).toEqual(["A", "C"]);
  });
  it("sem seleção, ninguém muda", () => {
    expect(alvosDaAcao([], "ativar")).toEqual([]);
  });
});

describe("contaProdutos", () => {
  it("singular e plural", () => {
    expect(contaProdutos(1)).toBe("1 produto");
    expect(contaProdutos(4)).toBe("4 produtos");
  });
});
