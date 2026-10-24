import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: (i: unknown) => unknown = (i) => i;
    const builder = {
      inputValidator(v: (i: unknown) => unknown) {
        validator = v;
        return builder;
      },
      middleware() {
        return builder;
      },
      handler(fn: (ctx: { data: unknown; context: unknown }) => unknown) {
        return async (opts?: { data?: unknown; context?: unknown }) =>
          fn({ data: validator(opts?.data), context: opts?.context });
      },
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from, rpc } }));
vi.mock("@/lib/founder-eventos.server", () => ({ registrarEventoSistema: vi.fn() }));

const api = vi.hoisted(() => ({
  buscarProdutos: vi.fn(),
  detalheProduto: vi.fn(),
  renovarTokens: vi.fn(),
}));
vi.mock("./tiktokShopApi", () => api);

import { salvarVinculosTiktok, listarAnunciosTiktok } from "./tiktokShopAnuncios.functions";
import { obterAcessoTiktok } from "./tiktokShopAcesso.server";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const salvar = salvarVinculosTiktok as unknown as Chamavel;
const listar = listarAnunciosTiktok as unknown as Chamavel;

const METODOS = [
  "select",
  "eq",
  "in",
  "limit",
  "maybeSingle",
  "single",
  "insert",
  "upsert",
  "update",
  "delete",
] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

let filas: Record<string, unknown[]> = {};
const consultas: Record<string, Consulta[]> = {};
function responder(tabela: string, ...resultados: unknown[]) {
  filas[tabela] = [...(filas[tabela] ?? []), ...resultados];
}
function roteador(alvo: Mock, prefixo = "") {
  alvo.mockImplementation((tabela: string) => {
    const chave = prefixo + tabela;
    const q = consulta((filas[chave] ?? []).shift() ?? { data: null, error: null });
    (consultas[chave] ??= []).push(q);
    return q;
  });
}

// Cliente com a sessão dela (context.supabase): insert em produtos e RPCs de estoque.
const fromUsuaria = vi.fn();
const rpcUsuaria = vi.fn();
const context = { userId: "u-1", supabase: { from: fromUsuaria, rpc: rpcUsuaria } };

beforeEach(() => {
  filas = {};
  for (const k of Object.keys(consultas)) delete consultas[k];
  from.mockReset();
  roteador(from);
  fromUsuaria.mockReset();
  roteador(fromUsuaria, "usuaria:");
  rpc.mockReset();
  rpcUsuaria.mockReset();
  rpcUsuaria.mockResolvedValue({ error: null });
  for (const fn of Object.values(api)) fn.mockReset();
});

const pro = () => responder("profiles", { data: { plano: "projete" } });
const conectada = () => responder("canal_conexoes", { data: { status: "conectada" } });

describe("salvarVinculosTiktok", () => {
  it("liga só variações da própria conta", async () => {
    pro();
    conectada();
    responder("produto_skus", { data: [{ id: "11111111-1111-1111-1111-111111111111" }] });
    const r = (await salvar({
      context,
      data: {
        itens: [
          {
            produtoExternoId: "p1",
            skuExternoId: "t1",
            destino: "sku:11111111-1111-1111-1111-111111111111",
          },
          {
            produtoExternoId: "p1",
            skuExternoId: "t2",
            destino: "sku:22222222-2222-2222-2222-222222222222",
          },
        ],
      },
    })) as { ok: boolean; ligados: number };
    expect(r).toMatchObject({ ok: true, ligados: 1 });
    const linhas = consultas.anuncio_vinculos[0].upsert.mock.calls[0][0] as {
      sku_externo_id: string;
    }[];
    expect(linhas.map((l) => l.sku_externo_id)).toEqual(["t1"]);
  });

  it("produto novo nasce com a sessão dela, com as variações e a quantidade do TikTok", async () => {
    pro();
    conectada();
    responder("usuaria:produtos", { data: { id: "prod-novo" }, error: null });
    responder("produto_skus", {
      data: [
        { id: "sk-az", variacao: "Azul", sku: "CAN-AZ" },
        { id: "sk-rs", variacao: "Rosa", sku: null },
      ],
    });
    const base = { produtoExternoId: "p9", destino: "novo", titulo: "Caneca Gato", preco: 39.9 };
    const r = (await salvar({
      context,
      data: {
        itens: [
          { ...base, skuExternoId: "t1", variacao: "Azul", codigo: "CAN-AZ", quantidade: 4 },
          { ...base, skuExternoId: "t2", variacao: "Rosa", codigo: null, quantidade: 0 },
        ],
      },
    })) as { ok: boolean; ligados: number; criados: number };
    expect(r).toMatchObject({ ok: true, ligados: 2, criados: 1 });
    expect(consultas["usuaria:produtos"][0].insert.mock.calls[0][0]).toMatchObject({
      user_id: "u-1",
      nome: "Caneca Gato",
      tipo: "fisico",
      preco_venda: 39.9,
    });
    expect(rpcUsuaria).toHaveBeenCalledWith("salvar_estoque_produto", {
      p_produto_id: "prod-novo",
      p_controla: true,
      p_variacoes: [
        { variacao: "Azul", sku: "CAN-AZ", inicial: 4 },
        { variacao: "Rosa", sku: null, inicial: 0 },
      ],
    });
    const linhas = consultas.anuncio_vinculos[0].upsert.mock.calls[0][0] as { sku_id: string }[];
    expect(linhas.map((l) => l.sku_id)).toEqual(["sk-az", "sk-rs"]);
  });

  it("estoque que não liga vira aviso, sem derrubar o resto", async () => {
    pro();
    conectada();
    responder("usuaria:produtos", { data: { id: "prod-novo" }, error: null });
    rpcUsuaria.mockResolvedValue({ error: { message: "duplicate key" } });
    const r = (await salvar({
      context,
      data: {
        itens: [{ produtoExternoId: "p9", skuExternoId: "t1", destino: "novo", titulo: "Bolsa" }],
      },
    })) as { ok: boolean; criados: number; avisos: string[] };
    expect(r.ok).toBe(true);
    expect(r.criados).toBe(0);
    expect(r.avisos[0]).toMatch(/Bolsa/);
  });

  it("produto sem estoque ligado ganha a variação padrão e liga", async () => {
    pro();
    conectada();
    const produtoId = "22222222-2222-2222-2222-222222222222";
    responder("produto_skus", { count: 0 }, { data: { id: "sk-padrao" } });
    const r = (await salvar({
      context,
      data: {
        itens: [{ produtoExternoId: "p1", skuExternoId: "t1", destino: `produto:${produtoId}` }],
      },
    })) as { ok: boolean; ligados: number };
    expect(r).toMatchObject({ ok: true, ligados: 1 });
    expect(rpcUsuaria).toHaveBeenCalledWith("salvar_estoque_produto", {
      p_produto_id: produtoId,
      p_controla: true,
      p_variacoes: [{ variacao: null, sku: null }],
    });
  });

  it("produto que já tem variações não é refeito com a padrão", async () => {
    pro();
    conectada();
    responder("produto_skus", { count: 2 });
    const r = (await salvar({
      context,
      data: {
        itens: [
          {
            produtoExternoId: "p1",
            skuExternoId: "t1",
            destino: "produto:22222222-2222-2222-2222-222222222222",
          },
        ],
      },
    })) as { ok: boolean; ligados: number; avisos: string[] };
    expect(rpcUsuaria).not.toHaveBeenCalled();
    expect(r.ligados).toBe(0);
    expect(r.avisos[0]).toMatch(/variação/);
  });

  it("não ligar apaga a ligação daquele anúncio", async () => {
    pro();
    conectada();
    await salvar({
      context,
      data: { itens: [{ produtoExternoId: "p1", skuExternoId: "t1", destino: "nenhum" }] },
    });
    const q = consultas.anuncio_vinculos[0];
    expect(q.delete).toHaveBeenCalled();
    expect(q.in).toHaveBeenCalledWith("sku_externo_id", ["t1"]);
  });

  it("destino fora do formato é recusado antes de tocar no banco", async () => {
    await expect(
      salvar({
        context,
        data: { itens: [{ produtoExternoId: "p", skuExternoId: "t", destino: "sku:abc" }] },
      }),
    ).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("listarAnunciosTiktok", () => {
  it("fora do Pro não chama o TikTok", async () => {
    responder("profiles", { data: { plano: "controle" } });
    const r = (await listar({ context })) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(api.buscarProdutos).not.toHaveBeenCalled();
  });
});

describe("obterAcessoTiktok", () => {
  const agora = Date.parse("2026-10-24T12:00:00Z");

  it("token válido sai direto, sem renovar", async () => {
    responder("canal_conexoes", { data: { id: "c-1", status: "conectada", shop_cipher: "C" } });
    rpc.mockResolvedValueOnce({
      data: [{ access_token: "at", refresh_token: "rt", access_expira_em: "2026-10-30T00:00:00Z" }],
    });
    const r = await obterAcessoTiktok("u-1", agora);
    expect(r.acesso).toEqual({ conexaoId: "c-1", accessToken: "at", shopCipher: "C" });
    expect(api.renovarTokens).not.toHaveBeenCalled();
  });

  it("perto de vencer, renova e grava no Vault", async () => {
    responder("canal_conexoes", { data: { id: "c-1", status: "conectada", shop_cipher: "C" } });
    rpc
      .mockResolvedValueOnce({
        data: [
          { access_token: "velho", refresh_token: "rt", access_expira_em: "2026-10-24T12:02:00Z" },
        ],
      })
      .mockResolvedValueOnce({ error: null });
    api.renovarTokens.mockResolvedValue({
      tokens: {
        accessToken: "novo",
        refreshToken: "rt2",
        accessExpiraEm: "x",
        refreshExpiraEm: "y",
      },
    });
    const r = await obterAcessoTiktok("u-1", agora);
    expect(r.acesso?.accessToken).toBe("novo");
    expect(rpc).toHaveBeenLastCalledWith(
      "canal_token_salvar",
      expect.objectContaining({ p_access: "novo" }),
    );
  });

  it("renovação recusada marca a conexão com erro e pede para conectar de novo", async () => {
    responder("canal_conexoes", { data: { id: "c-1", status: "conectada", shop_cipher: "C" } });
    rpc.mockResolvedValueOnce({
      data: [
        { access_token: "velho", refresh_token: "rt", access_expira_em: "2026-10-24T11:00:00Z" },
      ],
    });
    api.renovarTokens.mockResolvedValue({ tokens: null });
    const r = await obterAcessoTiktok("u-1", agora);
    expect(r.acesso).toBeNull();
    expect(r.error).toMatch(/Conecta de novo/);
    expect(consultas.canal_conexoes[1].update.mock.calls[0][0]).toMatchObject({ status: "erro" });
  });
});
