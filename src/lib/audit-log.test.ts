import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { getUserMock, insertMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  insertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: getUserMock }, from: fromMock },
}));

const { logAcaoAdmin } = await import("./audit-log");

describe("logAcaoAdmin", () => {
  beforeEach(() => {
    fromMock.mockReturnValue({ insert: insertMock });
    insertMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("grava em admin_audit_log com o id da admin, ação, alvo e detalhes", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    await logAcaoAdmin("flag_toggle", "csat_modal_ativo", { de: "off", para: "on" });
    expect(fromMock).toHaveBeenCalledWith("admin_audit_log");
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: "admin-1",
      acao: "flag_toggle",
      alvo: "csat_modal_ativo",
      detalhes: { de: "off", para: "on" },
    });
  });

  it("alvo e detalhes ausentes viram null e objeto vazio", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    await logAcaoAdmin("convite_criado");
    expect(insertMock.mock.calls[0][0]).toMatchObject({ alvo: null, detalhes: {} });
  });

  it("não grava sem usuária autenticada", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await logAcaoAdmin("x");
    expect(insertMock).not.toHaveBeenCalled();
  });

  // O log nunca pode quebrar a ação que ele registra.
  it("engole falha do insert sem lançar", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    insertMock.mockRejectedValue(new Error("rede"));
    await expect(logAcaoAdmin("x")).resolves.toBeUndefined();
  });
});
