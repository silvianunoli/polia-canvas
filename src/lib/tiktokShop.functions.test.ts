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
  tiktokConfigurado: vi.fn(),
  montarUrlAutorizacao: vi.fn(),
  trocarCodigoPorTokens: vi.fn(),
  lojasAutorizadas: vi.fn(),
}));
vi.mock("./tiktokShopApi", () => api);

import {
  statusConexaoTiktok,
  iniciarConexaoTiktok,
  finalizarConexaoTiktok,
  desconectarTiktok,
  confirmarConexaoTiktok,
} from "./tiktokShop.functions";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const statusFn = statusConexaoTiktok as unknown as Chamavel;
const iniciar = iniciarConexaoTiktok as unknown as Chamavel;
const finalizar = finalizarConexaoTiktok as unknown as Chamavel;
const desconectar = desconectarTiktok as unknown as Chamavel;

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

// Fila de respostas por tabela, na ordem em que a função consulta.
let filas: Record<string, unknown[]> = {};
const consultas: Record<string, Consulta[]> = {};
function responder(tabela: string, ...resultados: unknown[]) {
  filas[tabela] = [...(filas[tabela] ?? []), ...resultados];
}

const context = { userId: "u-1" };
const conexaoPendente = {
  id: "c-1",
  status: "pendente",
  state_pendente: "st-1",
  loja_nome: null,
  ultimo_sync: null,
  ultimo_erro: null,
  cuida_estoque: false,
};
const tokens = {
  accessToken: "at",
  refreshToken: "rt",
  accessExpiraEm: "2026-10-31T00:00:00.000Z",
  refreshExpiraEm: "2027-10-24T00:00:00.000Z",
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
  api.tiktokConfigurado.mockReturnValue(true);
});

describe("statusConexaoTiktok", () => {
  it("sem credenciais no servidor, a integração some da tela", async () => {
    api.tiktokConfigurado.mockReturnValue(false);
    expect(await statusFn({ context })).toEqual({ configurado: false });
    expect(from).not.toHaveBeenCalled();
  });

  it("conectada mostra loja e anúncios ligados; nada de token sai daqui", async () => {
    responder("canal_conexoes", {
      data: {
        ...conexaoPendente,
        status: "conectada",
        state_pendente: null,
        loja_nome: "Loja da Ana",
      },
    });
    responder("profiles", { data: { plano: "projete" } });
    responder("anuncio_vinculos", { count: 3 });
    expect(await statusFn({ context })).toEqual({
      configurado: true,
      liberado: true,
      conectada: true,
      lojaNome: "Loja da Ana",
      ultimoSync: null,
      erro: null,
      cuidaEstoque: false,
      anunciosLigados: 3,
    });
  });

  it("Premium não é liberado", async () => {
    responder("profiles", { data: { plano: "controle" } });
    const r = (await statusFn({ context })) as { liberado: boolean; conectada: boolean };
    expect(r.liberado).toBe(false);
    expect(r.conectada).toBe(false);
  });
});

describe("iniciarConexaoTiktok", () => {
  it("fora do Pro não gera link", async () => {
    responder("profiles", { data: { plano: "confere" } });
    const r = (await iniciar({ context })) as { url: string | null; error: string };
    expect(r.url).toBeNull();
    expect(r.error).toMatch(/Pro/);
    expect(api.montarUrlAutorizacao).not.toHaveBeenCalled();
  });

  it("no Pro guarda o state e devolve o link de autorização com ele", async () => {
    responder("profiles", { data: { plano: "projete" } });
    api.montarUrlAutorizacao.mockImplementation((s: string) => ({
      url: `https://tt/?state=${s}`,
      error: null,
    }));
    const r = (await iniciar({ context })) as { url: string };
    const upsert = consultas.canal_conexoes[1].upsert.mock.calls[0][0] as {
      state_pendente: string;
    };
    expect(r.url).toBe(`https://tt/?state=${upsert.state_pendente}`);
    expect(upsert).toMatchObject({ user_id: "u-1", canal: "tiktok_shop", status: "pendente" });
  });
});

describe("finalizarConexaoTiktok", () => {
  const entrada = { code: "code-1", state: "st-1" };

  it("state diferente do guardado não troca o code", async () => {
    responder("canal_conexoes", { data: { ...conexaoPendente, state_pendente: "outro" } });
    const r = (await finalizar({ data: entrada, context })) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(api.trocarCodigoPorTokens).not.toHaveBeenCalled();
  });

  it("salva os tokens pelo Vault e a loja do Brasil", async () => {
    responder("canal_conexoes", { data: conexaoPendente }, { data: null }, { error: null });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    api.lojasAutorizadas.mockResolvedValue({
      lojas: [
        { id: "s-us", name: "US", region: "US", cipher: "C-US" },
        { id: "s-br", name: "Loja da Ana", region: "BR", cipher: "C-BR" },
      ],
      error: null,
    });

    expect(await finalizar({ data: entrada, context })).toEqual({
      ok: true,
      error: null,
      lojaNome: "Loja da Ana",
    });
    expect(rpc).toHaveBeenCalledWith("canal_token_salvar", {
      p_conexao_id: "c-1",
      p_access: "at",
      p_refresh: "rt",
      p_access_expira: tokens.accessExpiraEm,
      p_refresh_expira: tokens.refreshExpiraEm,
    });
    const update = consultas.canal_conexoes[2].update.mock.calls[0][0] as Record<string, unknown>;
    expect(update).toMatchObject({
      status: "conectada",
      shop_id: "s-br",
      shop_cipher: "C-BR",
      state_pendente: null,
    });
    // O token nunca vai para a tabela.
    expect(Object.values(update)).not.toContain("at");
    expect(Object.values(update)).not.toContain("rt");
  });

  it("loja já ligada a outra conta não é conectada de novo", async () => {
    responder("canal_conexoes", { data: conexaoPendente }, { data: { id: "c-outra" } });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    api.lojasAutorizadas.mockResolvedValue({
      lojas: [{ id: "s-br", name: "Loja", region: "BR", cipher: "C" }],
      error: null,
    });
    const r = (await finalizar({ data: entrada, context })) as { ok: boolean; error: string };
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/outra conta/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sem loja autorizada, avisa e registra a falha", async () => {
    responder("canal_conexoes", { data: conexaoPendente });
    responder("profiles", { data: { plano: "projete" } });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    api.lojasAutorizadas.mockResolvedValue({ lojas: [], error: null });
    const r = (await finalizar({ data: entrada, context })) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(registrarEventoSistema).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "integration_failure", servico: "tiktok_shop" }),
    );
  });
});

describe("desconectarTiktok", () => {
  it("apaga a conexão (o gatilho leva os segredos) e os vínculos da conta", async () => {
    expect(await desconectar({ context })).toEqual({ ok: true, error: null });
    expect(consultas.canal_conexoes[0].delete).toHaveBeenCalled();
    expect(consultas.canal_conexoes[0].eq).toHaveBeenCalledWith("user_id", "u-1");
    expect(consultas.anuncio_vinculos[0].delete).toHaveBeenCalled();
    expect(consultas.anuncio_vinculos[0].eq).toHaveBeenCalledWith("user_id", "u-1");
  });
});

describe("autorização que começa no TikTok (sem state)", () => {
  const entrada = { code: "code-1" };
  const lojaBr = { id: "s-br", name: "Loja da Ana", region: "BR", cipher: "C-BR" };

  beforeEach(() => {
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens, error: null });
    api.lojasAutorizadas.mockResolvedValue({ lojas: [lojaBr], error: null });
  });

  it("sem conexão, cria a linha e espera a confirmação dela", async () => {
    responder(
      "canal_conexoes",
      { data: null },
      { data: null },
      { data: conexaoPendente },
      { error: null },
    );
    responder("profiles", { data: { plano: "projete" } });
    expect(await finalizar({ data: entrada, context })).toEqual({
      ok: true,
      error: null,
      lojaNome: "Loja da Ana",
      confirmar: true,
    });
    const update = consultas.canal_conexoes[3].update.mock.calls[0][0] as Record<string, unknown>;
    expect(update.status).toBe("aguardando_confirmacao");
    expect(rpc).toHaveBeenCalledWith(
      "canal_token_salvar",
      expect.objectContaining({ p_conexao_id: "c-1" }),
    );
  });

  it("a mesma loja já conectada só renova os tokens, sem pedir confirmação", async () => {
    const conectada = {
      ...conexaoPendente,
      status: "conectada",
      state_pendente: null,
      shop_id: "s-br",
    };
    responder("canal_conexoes", { data: conectada }, { data: null }, { error: null });
    responder("profiles", { data: { plano: "projete" } });
    const r = (await finalizar({ data: entrada, context })) as { ok: boolean; confirmar?: boolean };
    expect(r.ok).toBe(true);
    expect(r.confirmar).toBeUndefined();
    const update = consultas.canal_conexoes[2].update.mock.calls[0][0] as Record<string, unknown>;
    expect(update.status).toBe("conectada");
  });

  it("outra loja não troca a que está conectada", async () => {
    const conectada = {
      ...conexaoPendente,
      status: "conectada",
      state_pendente: null,
      shop_id: "s-outra",
    };
    responder("canal_conexoes", { data: conectada }, { data: null });
    responder("profiles", { data: { plano: "projete" } });
    const r = (await finalizar({ data: entrada, context })) as { ok: boolean; error: string };
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Desconecta antes/);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("confirmarConexaoTiktok", () => {
  const confirmar = confirmarConexaoTiktok as unknown as Chamavel;

  it("liga a loja que estava esperando", async () => {
    responder("profiles", { data: { plano: "projete" } });
    responder(
      "canal_conexoes",
      { data: { ...conexaoPendente, status: "aguardando_confirmacao", loja_nome: "Loja da Ana" } },
      { error: null },
    );
    expect(await confirmar({ context })).toEqual({
      ok: true,
      error: null,
      lojaNome: "Loja da Ana",
    });
    const q = consultas.canal_conexoes[1];
    expect(q.update.mock.calls[0][0]).toMatchObject({ status: "conectada" });
    expect(q.eq).toHaveBeenCalledWith("status", "aguardando_confirmacao");
  });

  it("sem loja esperando, não conecta nada", async () => {
    responder("profiles", { data: { plano: "projete" } });
    responder("canal_conexoes", { data: conexaoPendente });
    const r = (await confirmar({ context })) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(consultas.canal_conexoes).toHaveLength(1);
  });
});
