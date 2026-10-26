import { describe, it, expect, vi, beforeEach } from "vitest";

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
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

const api = vi.hoisted(() => ({ buscarIdsAnuncios: vi.fn(), detalhesAnuncios: vi.fn() }));
vi.mock("./mercadoLivreApi", () => api);
const acesso = vi.hoisted(() => ({ obterAcessoMercadoLivre: vi.fn() }));
vi.mock("./mercadoLivreAcesso.server", () => acesso);
const vinculos = vi.hoisted(() => ({
  temPro: vi.fn(),
  montarPrevia: vi.fn(),
  salvarVinculos: vi.fn(),
}));
vi.mock("./canalVinculos.server", async (original) => ({
  ...(await original<typeof import("./canalVinculos.server")>()),
  ...vinculos,
}));

import {
  listarAnunciosMercadoLivre,
  salvarVinculosMercadoLivre,
} from "./mercadoLivreAnuncios.functions";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const listar = listarAnunciosMercadoLivre as unknown as Chamavel;
const salvar = salvarVinculosMercadoLivre as unknown as Chamavel;
const context = { userId: "u-1", supabase: { sessao: true } };
const ACESSO = { conexaoId: "c-1", accessToken: "at", vendedoraId: "468424240" };

beforeEach(() => {
  for (const fn of [...Object.values(api), ...Object.values(acesso), ...Object.values(vinculos)])
    fn.mockReset();
  vinculos.temPro.mockResolvedValue(true);
  acesso.obterAcessoMercadoLivre.mockResolvedValue({ acesso: ACESSO, error: null });
  vinculos.montarPrevia.mockResolvedValue({ linhas: [], skus: [], produtosSemEstoque: [] });
});

const ids = (de: number, ate: number) => Array.from({ length: ate - de }, (_, i) => `MLB${de + i}`);

describe("listarAnunciosMercadoLivre", () => {
  it("fora do Pro não chama o Mercado Livre", async () => {
    vinculos.temPro.mockResolvedValue(false);
    const r = (await listar({ context })) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(acesso.obterAcessoMercadoLivre).not.toHaveBeenCalled();
  });

  it("sem acesso devolve o motivo (conexão caída, renovação em curso)", async () => {
    acesso.obterAcessoMercadoLivre.mockResolvedValue({ acesso: null, error: "venceu" });
    expect(await listar({ context })).toEqual({ ok: false, error: "venceu" });
  });

  it("pagina os ids, busca o detalhe em lotes de 20 e monta a prévia do canal certo", async () => {
    api.buscarIdsAnuncios
      .mockResolvedValueOnce({ ids: ids(0, 100), total: 130, error: null })
      .mockResolvedValueOnce({ ids: ids(100, 130), total: 130, error: null })
      .mockResolvedValueOnce({ ids: ["MLB900"], total: 1, error: null });
    api.detalhesAnuncios.mockImplementation(async ({ ids: lote }: { ids: string[] }) => ({
      anuncios: lote.map((id) => ({ id, title: id })),
      error: null,
    }));
    const r = (await listar({ context })) as { ok: boolean; incompleto: boolean };
    expect(r).toMatchObject({ ok: true, incompleto: false });
    expect(api.buscarIdsAnuncios).toHaveBeenCalledTimes(3);
    expect(api.buscarIdsAnuncios.mock.calls[1][0]).toMatchObject({
      vendedoraId: "468424240",
      status: "active",
      offset: 100,
      limite: 100,
    });
    // Pausados também entram: o que a Pólia pausou ao zerar o estoque.
    expect(api.buscarIdsAnuncios.mock.calls[2][0]).toMatchObject({ status: "paused", offset: 0 });
    expect(api.detalhesAnuncios).toHaveBeenCalledTimes(7);
    expect(
      api.detalhesAnuncios.mock.calls.every((c) => (c[0] as { ids: string[] }).ids.length <= 20),
    ).toBe(true);
    const [userId, canal, linhas] = vinculos.montarPrevia.mock.calls[0];
    expect(userId).toBe("u-1");
    expect(canal).toBe("mercado_livre");
    expect((linhas as unknown[]).length).toBe(131);
  });

  it("mais de 500 anúncios: para nos 500 e avisa", async () => {
    api.buscarIdsAnuncios.mockImplementation(async ({ offset }: { offset: number }) => ({
      ids: ids(offset, offset + 100),
      total: 800,
      error: null,
    }));
    api.detalhesAnuncios.mockResolvedValue({ anuncios: [], error: null });
    const r = (await listar({ context })) as { incompleto: boolean };
    expect(api.buscarIdsAnuncios).toHaveBeenCalledTimes(5);
    expect(r.incompleto).toBe(true);
  });

  it("erro do Mercado Livre na busca ou no detalhe vira mensagem para tentar de novo", async () => {
    api.buscarIdsAnuncios.mockResolvedValue({ ids: [], total: 0, error: "HTTP 500" });
    expect(((await listar({ context })) as { ok: boolean }).ok).toBe(false);

    api.buscarIdsAnuncios.mockResolvedValue({ ids: ids(0, 3), total: 3, error: null });
    api.detalhesAnuncios.mockResolvedValue({ anuncios: [], error: "HTTP 429" });
    const r = (await listar({ context })) as { ok: boolean; error: string };
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Tenta de novo");
    expect(vinculos.montarPrevia).not.toHaveBeenCalled();
  });
});

describe("salvarVinculosMercadoLivre", () => {
  it("grava pelo módulo comum, com o canal e o nome do Mercado Livre", async () => {
    vinculos.salvarVinculos.mockResolvedValue({
      ok: true,
      error: null,
      ligados: 1,
      criados: 0,
      avisos: [],
    });
    const item = {
      produtoExternoId: "MLB2",
      skuExternoId: "MLB2:101",
      destino: "sku:0b8c7f8e-1d2a-4c3b-9e8f-7a6b5c4d3e2f",
    };
    await salvar({ data: { itens: [item] }, context });
    expect(vinculos.salvarVinculos).toHaveBeenCalledWith({
      userId: "u-1",
      supabase: context.supabase,
      canal: "mercado_livre",
      nomeCanal: "Mercado Livre",
      itens: [item],
    });
  });

  it("destino fora do formato é recusado antes de qualquer coisa", async () => {
    await expect(
      salvar({
        data: { itens: [{ produtoExternoId: "a", skuExternoId: "b", destino: "drop" }] },
        context,
      }),
    ).rejects.toThrow();
    expect(vinculos.salvarVinculos).not.toHaveBeenCalled();
  });
});
