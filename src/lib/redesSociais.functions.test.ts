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
  montarUrlAutorizacao: vi.fn(),
  perfilInstagram: vi.fn(),
  perfilTiktok: vi.fn(),
  redeConfigurada: vi.fn(),
  redesAbertasParaClientes: vi.fn(),
  revogarAutorizacaoTiktok: vi.fn(),
  trocarCodigoDoInstagram: vi.fn(),
  trocarCodigoTiktok: vi.fn(),
}));
vi.mock("./redesSociaisApi", () => api);

import {
  desconectarRede,
  finalizarConexaoRede,
  iniciarConexaoRede,
  statusRedesSociais,
} from "./redesSociais.functions";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const statusFn = statusRedesSociais as unknown as Chamavel;
const iniciar = iniciarConexaoRede as unknown as Chamavel;
const finalizar = finalizarConexaoRede as unknown as Chamavel;
const desconectar = desconectarRede as unknown as Chamavel;

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
let consultas: Record<string, Consulta[]> = {};
function responder(tabela: string, ...resultados: unknown[]) {
  filas[tabela] = [...(filas[tabela] ?? []), ...resultados];
}

const context = { userId: "u-1" };
const perfilPro = { data: { plano: "projete", is_admin: true }, error: null };
const conexaoPendente = {
  id: "c-1",
  rede: "tiktok",
  status: "pendente",
  state_pendente: "st-1",
  conta_usuario: null,
  conta_nome: null,
  conta_foto_url: null,
  ultimo_erro: null,
};
const tokensTiktok = {
  accessToken: "act",
  refreshToken: "rft",
  accessExpiraEm: "2026-10-31T12:00:00.000Z",
  refreshExpiraEm: "2027-10-30T12:00:00.000Z",
  openId: "oid",
  escopos: "user.info.basic,video.publish",
};

beforeEach(() => {
  vi.clearAllMocks();
  filas = {};
  consultas = {};
  from.mockImplementation((tabela: string) => {
    const q = consulta((filas[tabela] ?? []).shift() ?? { data: null, error: null });
    (consultas[tabela] ??= []).push(q);
    return q;
  });
  rpc.mockResolvedValue({ data: null, error: null });
  api.redeConfigurada.mockReturnValue(true);
  api.redesAbertasParaClientes.mockReturnValue(false);
  api.montarUrlAutorizacao.mockReturnValue({ url: "https://www.tiktok.com/auth", error: null });
  api.perfilTiktok.mockResolvedValue({
    contaId: "oid",
    usuario: "hub.polia",
    nome: "Pólia",
    fotoUrl: null,
  });
});

describe("statusRedesSociais", () => {
  it("some para quem não é admin enquanto as revisões não aprovam", async () => {
    responder("profiles", { data: { plano: "projete", is_admin: false } });
    expect(await statusFn({ context })).toEqual({ visivel: false, liberado: false, redes: [] });
  });

  it("aberto para clientes: Premium vê o card com cadeado", async () => {
    api.redesAbertasParaClientes.mockReturnValue(true);
    api.redeConfigurada.mockImplementation((r: string) => r === "tiktok");
    responder("profiles", { data: { plano: "controle", is_admin: false } });
    const res = (await statusFn({ context })) as {
      visivel: boolean;
      liberado: boolean;
      redes: unknown[];
    };
    expect(res.visivel).toBe(true);
    expect(res.liberado).toBe(false);
    expect(res.redes).toHaveLength(1);
  });

  it("conectada mostra o @, nunca o token", async () => {
    api.redeConfigurada.mockImplementation((r: string) => r === "tiktok");
    responder("profiles", perfilPro);
    responder("redes_conexoes", {
      data: { ...conexaoPendente, status: "conectada", conta_usuario: "hub.polia" },
    });
    const res = (await statusFn({ context })) as { redes: Array<Record<string, unknown>> };
    expect(res.redes[0]).toEqual({
      rede: "tiktok",
      conectada: true,
      usuario: "hub.polia",
      nome: null,
      fotoUrl: null,
      erro: null,
    });
  });
});

describe("iniciarConexaoRede", () => {
  it("fora do Pro não abre a autorização", async () => {
    responder("profiles", { data: { plano: "controle", is_admin: true } });
    const res = (await iniciar({ data: { rede: "tiktok" }, context })) as { error: string };
    expect(res.error).toContain("Pro");
    expect(api.montarUrlAutorizacao).not.toHaveBeenCalled();
  });

  it("guarda o state e devolve a URL da rede", async () => {
    responder("profiles", perfilPro);
    const res = await iniciar({ data: { rede: "tiktok" }, context });
    expect(res).toEqual({ url: "https://www.tiktok.com/auth", error: null });
    const upsert = consultas.redes_conexoes[1].upsert.mock.calls[0][0] as {
      state_pendente: string;
    };
    expect(api.montarUrlAutorizacao).toHaveBeenCalledWith("tiktok", upsert.state_pendente);
  });

  it("rede inválida é recusada na entrada", async () => {
    await expect(iniciar({ data: { rede: "kwai" }, context })).rejects.toThrow();
  });
});

describe("finalizarConexaoRede", () => {
  it("state diferente não troca o code", async () => {
    responder("redes_conexoes", { data: conexaoPendente });
    const res = (await finalizar({
      data: { rede: "tiktok", code: "c", state: "outro" },
      context,
    })) as { ok: boolean };
    expect(res.ok).toBe(false);
    expect(api.trocarCodigoTiktok).not.toHaveBeenCalled();
  });

  it("TikTok: grava os tokens no Vault e o @ na conexão", async () => {
    responder("redes_conexoes", { data: conexaoPendente });
    responder("profiles", perfilPro);
    api.trocarCodigoTiktok.mockResolvedValue({ valor: tokensTiktok, error: null, recusado: false });
    const res = await finalizar({ data: { rede: "tiktok", code: "c", state: "st-1" }, context });
    expect(res).toEqual({ ok: true, error: null, usuario: "hub.polia" });
    expect(rpc).toHaveBeenCalledWith("redes_token_salvar", {
      p_conexao_id: "c-1",
      p_access: "act",
      p_refresh: "rft",
      p_access_expira: tokensTiktok.accessExpiraEm,
      p_refresh_expira: tokensTiktok.refreshExpiraEm,
    });
    const update = consultas.redes_conexoes[1].update.mock.calls[0][0] as Record<string, unknown>;
    expect(update).toMatchObject({ status: "conectada", state_pendente: null, conta_id: "oid" });
    expect(JSON.stringify(update)).not.toContain("act");
  });

  it("TikTok sem a permissão de publicar não conecta", async () => {
    responder("redes_conexoes", { data: conexaoPendente });
    responder("profiles", perfilPro);
    api.trocarCodigoTiktok.mockResolvedValue({
      valor: { ...tokensTiktok, escopos: "user.info.basic" },
      error: null,
      recusado: false,
    });
    const res = (await finalizar({
      data: { rede: "tiktok", code: "c", state: "st-1" },
      context,
    })) as { ok: boolean; error: string };
    expect(res.ok).toBe(false);
    expect(res.error).toContain("permissão de publicar");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("Instagram pessoal é recusado com o caminho pra trocar", async () => {
    responder("redes_conexoes", { data: { ...conexaoPendente, rede: "instagram" } });
    responder("profiles", perfilPro);
    api.trocarCodigoDoInstagram.mockResolvedValue({
      valor: {
        accessToken: "ig",
        accessExpiraEm: "2026-12-29T12:00:00.000Z",
        userId: "1",
        escopos: "",
      },
      error: null,
      recusado: false,
    });
    api.perfilInstagram.mockResolvedValue({
      contaId: "1",
      usuario: "pessoal",
      nome: null,
      fotoUrl: null,
      tipoConta: "PERSONAL",
    });
    const res = (await finalizar({
      data: { rede: "instagram", code: "AQ#_", state: "st-1" },
      context,
    })) as { ok: boolean; error: string };
    expect(api.trocarCodigoDoInstagram).toHaveBeenCalledWith("AQ");
    expect(res.ok).toBe(false);
    expect(res.error).toContain("profissional");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("desconectarRede", () => {
  it("TikTok: revoga lá, cancela os agendados e apaga a conexão", async () => {
    responder("redes_conexoes", { data: { ...conexaoPendente, status: "conectada" } });
    rpc.mockResolvedValueOnce({ data: [{ access_token: "act" }], error: null });
    const res = await desconectar({ data: { rede: "tiktok" }, context });
    expect(res).toEqual({ ok: true, error: null });
    expect(api.revogarAutorizacaoTiktok).toHaveBeenCalledWith("act");
    const cancela = consultas.redes_post_destinos[0];
    expect(cancela.update.mock.calls[0][0]).toMatchObject({ status: "cancelado" });
    expect(cancela.eq).toHaveBeenCalledWith("status", "pendente");
    const apaga = consultas.redes_conexoes[1];
    expect(apaga.delete).toHaveBeenCalled();
    expect(apaga.eq).toHaveBeenCalledWith("user_id", "u-1");
  });

  it("Instagram não chama revogar do TikTok", async () => {
    responder("redes_conexoes", {
      data: { ...conexaoPendente, rede: "instagram", status: "conectada" },
    });
    await desconectar({ data: { rede: "instagram" }, context });
    expect(api.revogarAutorizacaoTiktok).not.toHaveBeenCalled();
  });
});
