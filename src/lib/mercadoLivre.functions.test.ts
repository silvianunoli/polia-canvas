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

const { registrarEventoSistema } = vi.hoisted(() => ({ registrarEventoSistema: vi.fn() }));
vi.mock("@/lib/founder-eventos.server", () => ({ registrarEventoSistema }));

const api = vi.hoisted(() => ({
  mercadoLivreConfigurado: vi.fn(),
  montarUrlAutorizacao: vi.fn(),
  trocarCodigoPorTokens: vi.fn(),
  lerVendedora: vi.fn(),
}));
vi.mock("./mercadoLivreApi", () => api);

import {
  desconectarMercadoLivre,
  finalizarConexaoMercadoLivre,
  iniciarConexaoMercadoLivre,
  statusConexaoMercadoLivre,
} from "./mercadoLivre.functions";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const statusFn = statusConexaoMercadoLivre as unknown as Chamavel;
const iniciar = iniciarConexaoMercadoLivre as unknown as Chamavel;
const finalizar = finalizarConexaoMercadoLivre as unknown as Chamavel;
const desconectar = desconectarMercadoLivre as unknown as Chamavel;

const METODOS = ["select", "eq", "neq", "maybeSingle", "upsert", "update", "delete"] as const;
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

const context = { userId: "u-1" };
const VERIFICADOR = "v".repeat(64);
const conexaoPendente = {
  id: "c-1",
  status: "pendente",
  state_pendente: "st-1",
  verificador_pendente: VERIFICADOR,
  shop_id: null,
  loja_nome: null,
  ultimo_sync: null,
  ultimo_erro: null,
};
const tokens = {
  accessToken: "at",
  refreshToken: "rt",
  accessExpiraEm: "2026-10-24T18:00:00.000Z",
  vendedoraId: "468424240",
};

beforeEach(() => {
  filas = {};
  for (const k of Object.keys(consultas)) delete consultas[k];
  from.mockReset();
  from.mockImplementation((tabela: string) => {
    const q = consulta((filas[tabela] ?? []).shift() ?? { data: null, error: null });
    (consultas[tabela] ??= []).push(q);
    return q;
  });
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  registrarEventoSistema.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  api.mercadoLivreConfigurado.mockReturnValue(true);
});

describe("statusConexaoMercadoLivre", () => {
  it("sem credenciais no servidor, a integração some da tela", async () => {
    api.mercadoLivreConfigurado.mockReturnValue(false);
    expect(await statusFn({ context })).toEqual({ configurado: false });
    expect(from).not.toHaveBeenCalled();
  });

  it("conectada mostra o apelido e os anúncios ligados; nada de token sai daqui", async () => {
    responder("canal_conexoes", {
      data: {
        ...conexaoPendente,
        status: "conectada",
        state_pendente: null,
        loja_nome: "LOJADAANA",
      },
    });
    responder("profiles", { data: { plano: "projete" } });
    responder("anuncio_vinculos", { count: 2 });
    expect(await statusFn({ context })).toEqual({
      configurado: true,
      liberado: true,
      conectada: true,
      lojaNome: "LOJADAANA",
      ultimoSync: null,
      erro: null,
      anunciosLigados: 2,
    });
    expect(consultas.canal_conexoes[0].eq).toHaveBeenCalledWith("canal", "mercado_livre");
  });

  it("conexão em erro mostra o motivo e não mostra a loja", async () => {
    responder("canal_conexoes", {
      data: { ...conexaoPendente, status: "erro", loja_nome: "X", ultimo_erro: "venceu" },
    });
    responder("profiles", { data: { plano: "projete" } });
    const r = (await statusFn({ context })) as { erro: string | null; lojaNome: string | null };
    expect(r.erro).toBe("venceu");
    expect(r.lojaNome).toBeNull();
  });
});

describe("iniciarConexaoMercadoLivre", () => {
  it("Premium não conecta", async () => {
    responder("profiles", { data: { plano: "controle" } });
    expect(await iniciar({ context })).toEqual({
      url: null,
      error: "A integração com o Mercado Livre é do plano Pro.",
    });
    expect(api.montarUrlAutorizacao).not.toHaveBeenCalled();
  });

  it("já conectada não troca de conta", async () => {
    responder("profiles", { data: { plano: "projete" } });
    responder("canal_conexoes", { data: { ...conexaoPendente, status: "conectada" } });
    const r = (await iniciar({ context })) as { url: string | null };
    expect(r.url).toBeNull();
  });

  it("guarda state e verificador do PKCE e monta a URL com os dois", async () => {
    responder("profiles", { data: { plano: "projete" } });
    api.montarUrlAutorizacao.mockResolvedValue({ url: "https://auth/x", error: null });
    expect(await iniciar({ context })).toEqual({ url: "https://auth/x", error: null });
    const gravado = consultas.canal_conexoes[1].upsert.mock.calls[0][0] as Record<string, string>;
    expect(gravado.canal).toBe("mercado_livre");
    expect(gravado.status).toBe("pendente");
    expect(gravado.verificador_pendente).toMatch(/^[A-Za-z0-9\-_]{64}$/);
    expect(api.montarUrlAutorizacao).toHaveBeenCalledWith(
      gravado.state_pendente,
      gravado.verificador_pendente,
    );
  });
});

describe("finalizarConexaoMercadoLivre", () => {
  it("state que não bate é recusado antes de trocar o code", async () => {
    responder("canal_conexoes", { data: conexaoPendente });
    const r = (await finalizar({ data: { code: "c", state: "outro" }, context })) as {
      ok: boolean;
    };
    expect(r.ok).toBe(false);
    expect(api.trocarCodigoPorTokens).not.toHaveBeenCalled();
  });

  it("volta sem state não é aceita", async () => {
    await expect(finalizar({ data: { code: "c" }, context })).rejects.toThrow();
  });

  it("conecta: zera state, troca com o verificador, salva token e apelido", async () => {
    responder("canal_conexoes", { data: conexaoPendente });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    api.lerVendedora.mockResolvedValue({
      vendedora: { id: "468424240", apelido: "LOJADAANA" },
      error: null,
    });
    const r = await finalizar({ data: { code: "c", state: "st-1" }, context });
    expect(r).toEqual({ ok: true, error: null, lojaNome: "LOJADAANA" });

    expect(consultas.canal_conexoes[1].update).toHaveBeenCalledWith({
      state_pendente: null,
      verificador_pendente: null,
    });
    expect(api.trocarCodigoPorTokens).toHaveBeenCalledWith("c", VERIFICADOR);
    expect(rpc).toHaveBeenCalledWith("canal_token_salvar", {
      p_conexao_id: "c-1",
      p_access: "at",
      p_refresh: "rt",
      p_access_expira: "2026-10-24T18:00:00.000Z",
      p_refresh_expira: null,
    });
    const final = consultas.canal_conexoes[3].update.mock.calls[0][0] as Record<string, string>;
    expect(final).toMatchObject({
      status: "conectada",
      shop_id: "468424240",
      loja_nome: "LOJADAANA",
    });
  });

  it("conta do Mercado Livre já ligada em outra conta da Pólia não conecta", async () => {
    responder("canal_conexoes", { data: conexaoPendente }, { data: null }, { data: { id: "c-9" } });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    const r = (await finalizar({ data: { code: "c", state: "st-1" }, context })) as {
      ok: boolean;
      error: string;
    };
    expect(r.ok).toBe(false);
    expect(r.error).toContain("outra conta");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reconectar com outra conta do Mercado Livre apaga as ligações antigas", async () => {
    responder("canal_conexoes", { data: { ...conexaoPendente, shop_id: "111" } });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    api.lerVendedora.mockResolvedValue({
      vendedora: { id: "468424240", apelido: "NOVA" },
      error: null,
    });
    await finalizar({ data: { code: "c", state: "st-1" }, context });
    expect(consultas.anuncio_vinculos?.[0].delete).toHaveBeenCalled();
    expect(consultas.anuncio_vinculos?.[0].eq).toHaveBeenCalledWith("canal", "mercado_livre");
  });

  it("sem o apelido, conecta com nome padrão e registra a falha", async () => {
    responder("canal_conexoes", { data: conexaoPendente });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    api.lerVendedora.mockResolvedValue({ vendedora: null, error: "HTTP 500" });
    const r = await finalizar({ data: { code: "c", state: "st-1" }, context });
    expect(r).toEqual({ ok: true, error: null, lojaNome: "Conta do Mercado Livre" });
    expect(registrarEventoSistema).toHaveBeenCalled();
  });

  it("Mercado Livre recusa o code: não salva nada", async () => {
    responder("canal_conexoes", { data: conexaoPendente });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens: null, error: "recusou" });
    expect(await finalizar({ data: { code: "c", state: "st-1" }, context })).toEqual({
      ok: false,
      error: "recusou",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("desconectarMercadoLivre", () => {
  it("apaga a conexão e as ligações só do Mercado Livre", async () => {
    expect(await desconectar({ context })).toEqual({ ok: true, error: null });
    expect(consultas.canal_conexoes[0].delete).toHaveBeenCalled();
    expect(consultas.canal_conexoes[0].eq).toHaveBeenCalledWith("canal", "mercado_livre");
    expect(consultas.anuncio_vinculos[0].eq).toHaveBeenCalledWith("canal", "mercado_livre");
  });
});
