import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

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

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

const { registrarEventoSistema } = vi.hoisted(() => ({ registrarEventoSistema: vi.fn() }));
vi.mock("@/lib/founder-eventos.server", () => ({ registrarEventoSistema }));

const api = vi.hoisted(() => ({
  montarUrlConsentimento: vi.fn(),
  trocarCodigoPorTokens: vi.fn(),
  renovarAccessToken: vi.fn(),
  buscarEmailConectado: vi.fn(),
  listarEventosGoogle: vi.fn(),
  revogarToken: vi.fn(),
}));
vi.mock("./googleCalendarApi", () => api);

import {
  statusConexaoGoogle,
  iniciarConexaoGoogle,
  finalizarConexaoGoogle,
  listarEventosDoMes,
  desconectarGoogle,
} from "./calendarGoogle.functions";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const statusFn = statusConexaoGoogle as unknown as Chamavel;
const iniciar = iniciarConexaoGoogle as unknown as Chamavel;
const finalizar = finalizarConexaoGoogle as unknown as Chamavel;
const listar = listarEventosDoMes as unknown as Chamavel;
const desconectar = desconectarGoogle as unknown as Chamavel;

const METODOS = ["select", "eq", "maybeSingle", "upsert", "update", "delete"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const context = { userId: "u-1" };
const conexaoBase = {
  access_token: "at",
  refresh_token: "rt",
  expires_at: "2099-01-01T00:00:00Z",
  email_conectado: "ana@gmail.com",
  state_pendente: null,
};
function conexao(row: unknown) {
  from.mockReturnValueOnce(consulta({ data: row }));
}

beforeEach(() => {
  from.mockReset();
  registrarEventoSistema.mockReset();
  for (const fn of Object.values(api)) fn.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.useRealTimers());

describe("statusConexaoGoogle", () => {
  it("conectado é ter refresh_token, não só linha na tabela", async () => {
    conexao(null);
    expect(await statusFn({ context })).toEqual({ conectado: false, email: null });
    conexao({ ...conexaoBase, refresh_token: null });
    expect(await statusFn({ context })).toEqual({ conectado: false, email: "ana@gmail.com" });
    conexao(conexaoBase);
    expect(await statusFn({ context })).toEqual({ conectado: true, email: "ana@gmail.com" });
  });
});

describe("iniciarConexaoGoogle", () => {
  it("guarda um state novo por usuária e monta a URL com o mesmo state", async () => {
    const up = consulta({ error: null });
    from.mockReturnValueOnce(up);
    api.montarUrlConsentimento.mockReturnValue({ url: "https://google/x", error: null });

    expect(await iniciar({ context })).toEqual({ url: "https://google/x", error: null });
    const [payload, opcoes] = up.upsert.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(payload.user_id).toBe("u-1");
    expect(payload.state_pendente).toMatch(/^[0-9a-f-]{36}$/);
    expect(opcoes).toEqual({ onConflict: "user_id" });
    expect(api.montarUrlConsentimento).toHaveBeenCalledWith(payload.state_pendente);
  });

  it("falha ao guardar o state não gera URL (o callback não teria como validar)", async () => {
    from.mockReturnValueOnce(consulta({ error: { message: "db" } }));
    expect(await iniciar({ context })).toEqual({
      url: null,
      error: "Não conseguimos iniciar a conexão. Tenta de novo.",
    });
    expect(api.montarUrlConsentimento).not.toHaveBeenCalled();
  });
});

describe("finalizarConexaoGoogle", () => {
  const data = { code: "cod", state: "st-1" };

  it("code ou state vazios rejeitam", async () => {
    await expect(finalizar({ data: { code: "", state: "x" }, context })).rejects.toThrow();
    await expect(finalizar({ data: { code: "x", state: "" }, context })).rejects.toThrow();
  });

  it("state diferente do pendente é recusado (proteção CSRF do OAuth)", async () => {
    conexao({ ...conexaoBase, state_pendente: "outro" });
    expect(await finalizar({ data, context })).toEqual({
      ok: false,
      error: "Essa conexão expirou ou não é sua. Tenta conectar de novo.",
    });
    expect(api.trocarCodigoPorTokens).not.toHaveBeenCalled();
  });

  it("Google recusa o code: repassa o erro sem salvar", async () => {
    conexao({ ...conexaoBase, state_pendente: "st-1" });
    api.trocarCodigoPorTokens.mockResolvedValue({ tokens: null, error: "invalid_grant" });
    expect(await finalizar({ data, context })).toEqual({ ok: false, error: "invalid_grant" });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("salva tokens, e-mail e limpa o state; refresh_token só quando o Google mandar", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-22T10:00:00Z") });
    conexao({ ...conexaoBase, state_pendente: "st-1" });
    const up = consulta({ error: null });
    from.mockReturnValueOnce(up);
    api.trocarCodigoPorTokens.mockResolvedValue({
      tokens: { access_token: "novo", expires_in: 3600 },
      error: null,
    });
    api.buscarEmailConectado.mockResolvedValue("ana@gmail.com");

    expect(await finalizar({ data, context })).toEqual({ ok: true, error: null });
    const payload = up.update.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        access_token: "novo",
        expires_at: "2026-09-22T11:00:00.000Z",
        email_conectado: "ana@gmail.com",
        state_pendente: null,
      }),
    );
    // Sem refresh_token na resposta, o salvo continua valendo.
    expect(payload).not.toHaveProperty("refresh_token");
    expect(up.eq).toHaveBeenCalledWith("user_id", "u-1");
  });

  it("refresh_token presente entra no payload", async () => {
    conexao({ ...conexaoBase, state_pendente: "st-1" });
    const up = consulta({ error: null });
    from.mockReturnValueOnce(up);
    api.trocarCodigoPorTokens.mockResolvedValue({
      tokens: { access_token: "novo", refresh_token: "rt-novo", expires_in: 10 },
      error: null,
    });
    api.buscarEmailConectado.mockResolvedValue(null);
    await finalizar({ data, context });
    expect(up.update.mock.calls[0][0]).toEqual(
      expect.objectContaining({ refresh_token: "rt-novo", email_conectado: null }),
    );
  });

  it("falha ao salvar devolve mensagem própria", async () => {
    conexao({ ...conexaoBase, state_pendente: "st-1" });
    from.mockReturnValueOnce(consulta({ error: { message: "db" } }));
    api.trocarCodigoPorTokens.mockResolvedValue({
      tokens: { access_token: "novo", expires_in: 10 },
      error: null,
    });
    api.buscarEmailConectado.mockResolvedValue(null);
    expect(await finalizar({ data, context })).toEqual({
      ok: false,
      error: "Conectamos com o Google mas não conseguimos salvar. Tenta de novo.",
    });
  });
});

describe("listarEventosDoMes", () => {
  const data = { inicioISO: "2026-09-01", fimISO: "2026-09-30" };
  const EXPIRADA = "Sua conexão com o Google expirou. Reconecte.";

  it("sem refresh_token devolve desconectado sem falar com o Google", async () => {
    conexao({ ...conexaoBase, refresh_token: null });
    expect(await listar({ data, context })).toEqual({
      eventos: [],
      error: null,
      conectado: false,
    });
    expect(api.listarEventosGoogle).not.toHaveBeenCalled();
  });

  it("token válido: lista direto sem renovar", async () => {
    conexao(conexaoBase);
    api.listarEventosGoogle.mockResolvedValue({ eventos: [{ id: "e1" }], error: null });
    expect(await listar({ data, context })).toEqual({
      eventos: [{ id: "e1" }],
      error: null,
      conectado: true,
    });
    expect(api.renovarAccessToken).not.toHaveBeenCalled();
    expect(api.listarEventosGoogle).toHaveBeenCalledWith("at", "2026-09-01", "2026-09-30");
  });

  it("token vencido: renova, salva o novo e lista com ele", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-22T10:00:00Z") });
    conexao({ ...conexaoBase, expires_at: "2026-09-22T09:00:00Z" });
    const up = consulta({ error: null });
    from.mockReturnValueOnce(up);
    api.renovarAccessToken.mockResolvedValue({ access_token: "at2", expires_in: 3600 });
    api.listarEventosGoogle.mockResolvedValue({ eventos: [], error: null });

    const r = await listar({ data, context });
    expect(api.renovarAccessToken).toHaveBeenCalledWith("rt");
    expect(up.update).toHaveBeenCalledWith({
      access_token: "at2",
      expires_at: "2026-09-22T11:00:00.000Z",
    });
    expect(api.listarEventosGoogle).toHaveBeenCalledWith("at2", "2026-09-01", "2026-09-30");
    expect(r).toEqual({ eventos: [], error: null, conectado: true });
  });

  it("sem access_token salvo também renova, mesmo com expires_at no futuro", async () => {
    conexao({ ...conexaoBase, access_token: null });
    from.mockReturnValueOnce(consulta({ error: null }));
    api.renovarAccessToken.mockResolvedValue({ access_token: "at2", expires_in: 10 });
    api.listarEventosGoogle.mockResolvedValue({ eventos: [], error: null });
    await listar({ data, context });
    expect(api.renovarAccessToken).toHaveBeenCalledWith("rt");
  });

  it("refresh recusado: registra integration_failure e pede reconexão", async () => {
    conexao({ ...conexaoBase, expires_at: null });
    api.renovarAccessToken.mockResolvedValue(null);
    expect(await listar({ data, context })).toEqual({
      eventos: [],
      error: EXPIRADA,
      conectado: false,
    });
    expect(registrarEventoSistema).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "integration_failure",
        servico: "google_calendar",
        detalhes: { motivo: "refresh_token_recusado" },
      }),
    );
    expect(api.listarEventosGoogle).not.toHaveBeenCalled();
  });

  it("Google responde 401 na listagem: trata como expirada", async () => {
    conexao(conexaoBase);
    api.listarEventosGoogle.mockResolvedValue({ eventos: [], error: null, expirado: true });
    expect(await listar({ data, context })).toEqual({
      eventos: [],
      error: EXPIRADA,
      conectado: false,
    });
  });

  it("erro comum da listagem é repassado com conectado true", async () => {
    conexao(conexaoBase);
    api.listarEventosGoogle.mockResolvedValue({ eventos: undefined, error: "quota" });
    expect(await listar({ data, context })).toEqual({
      eventos: [],
      error: "quota",
      conectado: true,
    });
  });
});

describe("desconectarGoogle", () => {
  it("revoga o token no Google (quando existe) e apaga a linha", async () => {
    conexao(conexaoBase);
    const del = consulta({ error: null });
    from.mockReturnValueOnce(del);
    api.revogarToken.mockResolvedValue(undefined);
    expect(await desconectar({ context })).toEqual({ ok: true });
    expect(api.revogarToken).toHaveBeenCalledWith("at");
    expect(del.delete).toHaveBeenCalled();
    expect(del.eq).toHaveBeenCalledWith("user_id", "u-1");
  });

  it("sem access_token não chama o Google, só apaga", async () => {
    conexao({ ...conexaoBase, access_token: null });
    from.mockReturnValueOnce(consulta({ error: null }));
    expect(await desconectar({ context })).toEqual({ ok: true });
    expect(api.revogarToken).not.toHaveBeenCalled();
  });
});
