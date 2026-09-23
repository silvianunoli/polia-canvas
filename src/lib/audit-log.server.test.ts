import { describe, it, expect, vi, beforeEach } from "vitest";

const { from, insert } = vi.hoisted(() => {
  const insert = vi.fn();
  return { insert, from: vi.fn(() => ({ insert })) };
});
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

import { logAcaoAdminServer } from "./audit-log.server";

beforeEach(() => {
  from.mockClear();
  insert.mockReset();
});

describe("logAcaoAdminServer", () => {
  it("grava admin, ação, alvo e detalhes (com defaults nulo/vazio)", async () => {
    insert.mockResolvedValue({ error: null });
    await logAcaoAdminServer("admin-1", "criar_convite", "ana@x.com", { origem: "ui" });
    expect(from).toHaveBeenCalledWith("admin_audit_log");
    expect(insert).toHaveBeenCalledWith({
      admin_id: "admin-1",
      acao: "criar_convite",
      alvo: "ana@x.com",
      detalhes: { origem: "ui" },
    });

    await logAcaoAdminServer("admin-1", "remover_convite");
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ alvo: null, detalhes: {} }));
  });

  it("falha do banco nunca quebra a ação que está sendo registrada", async () => {
    insert.mockRejectedValue(new Error("db"));
    await expect(logAcaoAdminServer("admin-1", "x")).resolves.toBeUndefined();
    from.mockImplementationOnce(() => {
      throw new Error("sem env");
    });
    await expect(logAcaoAdminServer("admin-1", "x")).resolves.toBeUndefined();
  });
});
