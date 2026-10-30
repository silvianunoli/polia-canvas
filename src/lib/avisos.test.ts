import { describe, expect, it } from "vitest";
import {
  contarNaoLidos,
  itensDoSino,
  novidadesDaConta,
  novidadesPendentes,
  quandoFoi,
  rotuloContador,
  type LinhaAviso,
  type Novidade,
} from "./avisos";

const aviso = (id: string, created_at: string, lido = false): LinhaAviso => ({
  id,
  tipo: "pedido",
  titulo: "Pedido novo da loja",
  corpo: "Ana",
  valor: 289,
  link: "/pedidos",
  lido_em: lido ? created_at : null,
  created_at,
});

const novidade = (id: string, publicada_em: string): Novidade => ({
  id,
  titulo: `Novidade ${id}`,
  texto: "texto",
  imagem_url: null,
  link: null,
  link_rotulo: null,
  publicada_em,
});

describe("itensDoSino", () => {
  it("junta avisos e novidades do mais novo pro mais antigo", () => {
    const itens = itensDoSino(
      [aviso("a1", "2026-10-29T10:00:00Z"), aviso("a2", "2026-10-29T12:00:00Z", true)],
      [novidade("n1", "2026-10-29T11:00:00Z")],
      new Set(),
    );
    expect(itens.map((i) => i.chave)).toEqual(["aviso-a2", "novidade-n1", "aviso-a1"]);
    expect(contarNaoLidos(itens)).toBe(2);
  });

  it("novidade já lida não conta no sino", () => {
    const itens = itensDoSino([], [novidade("n1", "2026-10-29T11:00:00Z")], new Set(["n1"]));
    expect(itens[0].lido).toBe(true);
    expect(contarNaoLidos(itens)).toBe(0);
  });

  it("valor que vem como texto do banco vira número", () => {
    const itens = itensDoSino([{ ...aviso("a1", "2026-10-29T10:00:00Z"), valor: "144.50" as unknown as number }], [], new Set());
    expect(itens[0].valor).toBe(144.5);
  });
});

describe("novidadesDaConta", () => {
  const lista = [novidade("velha", "2026-09-01T00:00:00Z"), novidade("nova", "2026-10-29T00:00:00Z")];

  it("conta nova não recebe o que saiu antes dela", () => {
    expect(novidadesDaConta(lista, "2026-10-01T00:00:00Z").map((n) => n.id)).toEqual(["nova"]);
  });

  it("sem data da conta, mostra tudo", () => {
    expect(novidadesDaConta(lista, null)).toHaveLength(2);
  });
});

describe("novidadesPendentes", () => {
  it("tira as lidas e ordena da mais nova pra mais antiga", () => {
    const lista = [
      novidade("n1", "2026-10-01T00:00:00Z"),
      novidade("n2", "2026-10-29T00:00:00Z"),
      novidade("n3", "2026-10-15T00:00:00Z"),
    ];
    expect(novidadesPendentes(lista, new Set(["n3"])).map((n) => n.id)).toEqual(["n2", "n1"]);
  });
});

describe("rotuloContador e quandoFoi", () => {
  it("acima de 9 vira 9+", () => {
    expect(rotuloContador(3)).toBe("3");
    expect(rotuloContador(12)).toBe("9+");
  });

  it("escreve há quanto tempo", () => {
    const agora = new Date("2026-10-29T12:00:00Z");
    expect(quandoFoi("2026-10-29T11:59:40Z", agora)).toBe("agora");
    expect(quandoFoi("2026-10-29T11:55:00Z", agora)).toBe("há 5 min");
    expect(quandoFoi("2026-10-29T09:00:00Z", agora)).toBe("há 3 h");
    expect(quandoFoi("2026-10-28T10:00:00Z", agora)).toBe("ontem");
    expect(quandoFoi("2026-10-25T10:00:00Z", agora)).toBe("há 4 dias");
  });
});
