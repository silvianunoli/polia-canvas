import { describe, it, expect, vi, beforeEach } from "vitest";

// Cada tabela devolve o que está em `tabelas`; os filtros ficam guardados pra conferir.
const { tabelas, filtros } = vi.hoisted(() => ({
  tabelas: {} as Record<string, unknown>,
  filtros: [] as Array<[string, string, unknown]>,
}));
vi.mock("@/integrations/supabase/client.server", () => {
  const consulta = (tabela: string) => {
    const q: Record<string, unknown> = {};
    const resolve = () => Promise.resolve({ data: tabelas[tabela] ?? null, error: null });
    for (const m of ["select", "order"]) q[m] = () => q;
    for (const m of ["eq", "in"])
      q[m] = (col: string, val: unknown) => (filtros.push([tabela, col, val]), q);
    q.maybeSingle = resolve;
    q.then = (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) =>
      resolve().then(ok, erro);
    return q;
  };
  return {
    supabaseAdmin: {
      from: consulta,
      storage: {
        from: () => ({
          getPublicUrl: (p: string) => ({ data: { publicUrl: `https://s/pub/${p}` } }),
        }),
      },
    },
  };
});

import { responderVitrineCatalogo } from "./vitrine.server";

const req = (dominio: string | null, metodo = "GET") =>
  new Request(
    `https://one.usepolia.com.br/api/catalogo/vitrine${dominio === null ? "" : `?dominio=${dominio}`}`,
    { method: metodo },
  );

beforeEach(() => {
  for (const k of Object.keys(tabelas)) delete tabelas[k];
  filtros.length = 0;
  tabelas.canal_conexoes = { user_id: "u1" };
  tabelas.profiles = { plano: "projete" };
  tabelas.produtos = [
    {
      id: "p1",
      nome: "Bolsa Hailey - Fio de Malha",
      descricao: "Preto e branco",
      preco_venda: "189",
      foto_url: null,
      catalogo_ordem: null,
    },
    {
      id: "p2",
      nome: "Bolsa Amy",
      descricao: null,
      preco_venda: "209.9",
      foto_url: "https://loja/amy.webp",
      catalogo_ordem: 2,
    },
  ];
  tabelas.produto_fotos = [
    { produto_id: "p1", path: "u1/p1-a.jpg", ordem: 0 },
    { produto_id: "p1", path: "u1/p1-b.jpg", ordem: 1 },
  ];
});

describe("GET /api/catalogo/vitrine", () => {
  it("devolve os produtos no catálogo da loja do domínio, com as fotos na ordem", async () => {
    const r = await responderVitrineCatalogo(req("www.LovelessCrochet.com.br"));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=30");
    const corpo = (await r.json()) as { ok: boolean; produtos: unknown[] };
    expect(corpo.produtos).toEqual([
      {
        id: "p1",
        nome: "Bolsa Hailey - Fio de Malha",
        descricao: "Preto e branco",
        preco: 189,
        ordem: null,
        fotos: ["https://s/pub/u1/p1-a.jpg", "https://s/pub/u1/p1-b.jpg"],
      },
      {
        id: "p2",
        nome: "Bolsa Amy",
        descricao: null,
        preco: 209.9,
        ordem: 2,
        fotos: ["https://loja/amy.webp"],
      },
    ]);
    expect(filtros).toContainEqual(["canal_conexoes", "shop_id", "lovelesscrochet.com.br"]);
    expect(filtros).toContainEqual(["produtos", "user_id", "u1"]);
    expect(filtros).toContainEqual(["produtos", "no_catalogo", true]);
    expect(filtros).toContainEqual(["produtos", "arquivado", false]);
  });

  it("some (404) sem domínio, com domínio sem loja e fora do Pro", async () => {
    expect((await responderVitrineCatalogo(req(null))).status).toBe(404);
    tabelas.canal_conexoes = null;
    expect((await responderVitrineCatalogo(req("outraloja.com.br"))).status).toBe(404);
    tabelas.canal_conexoes = { user_id: "u1" };
    tabelas.profiles = { plano: "controle" };
    expect((await responderVitrineCatalogo(req("lovelesscrochet.com.br"))).status).toBe(404);
  });

  it("só aceita GET", async () => {
    expect((await responderVitrineCatalogo(req("lovelesscrochet.com.br", "POST"))).status).toBe(
      405,
    );
  });
});
