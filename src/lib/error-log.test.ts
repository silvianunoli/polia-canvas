import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { getSessionMock, insertMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  insertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: getSessionMock }, from: fromMock },
}));

const { logErroCliente } = await import("./error-log");

// As regras de mascaramento estão cobertas em error-sanitize.test.ts; aqui o
// que importa é que o insert passa PELO sanitizador e leva os campos certos.
describe("logErroCliente", () => {
  beforeEach(() => {
    fromMock.mockReturnValue({ insert: insertMock });
    insertMock.mockResolvedValue({ error: null });
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("grava em erros_app com origem client, página atual e user_id da sessão", async () => {
    await logErroCliente("falha no render", "Error: x\n  at a.js:1");
    expect(fromMock).toHaveBeenCalledWith("erros_app");
    expect(insertMock).toHaveBeenCalledWith({
      origem: "client",
      mensagem: "falha no render",
      stack: "Error: x\n  at a.js:1",
      pagina: "/",
      user_id: "u1",
    });
  });

  // LGPD-03: e-mail na mensagem e token na query nunca chegam ao banco.
  it("mascara dado pessoal na mensagem e tira a query string da página", async () => {
    await logErroCliente("erro pra ana@exemplo.com", undefined, "/painel?token=abc123");
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      mensagem: "erro pra [email]",
      stack: null,
      pagina: "/painel",
    });
  });

  it("visitante anônima grava user_id null", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    await logErroCliente("x");
    expect(insertMock.mock.calls[0][0].user_id).toBeNull();
  });

  it("não grava nada sem window (SSR)", async () => {
    vi.stubGlobal("window", undefined);
    await logErroCliente("x");
    expect(insertMock).not.toHaveBeenCalled();
  });

  // Log de erro que falha não pode gerar outro erro.
  it("engole falha do insert sem lançar", async () => {
    insertMock.mockRejectedValue(new Error("rede"));
    await expect(logErroCliente("x")).resolves.toBeUndefined();
  });
});
