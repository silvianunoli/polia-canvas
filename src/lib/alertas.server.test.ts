import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispararAlerta } from "./alertas.server";

// Alerta é fire-and-forget: nunca pode derrubar o checkout que o disparou.

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.SUPABASE_URL = "https://proj.supabase.co";
  process.env.ALERTAS_SECRET = "segredo";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.ALERTAS_SECRET;
});

describe("dispararAlerta", () => {
  it("chama a edge function alertas-criticos com o secret no header e o payload no body", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await dispararAlerta("checkout_erro", "Erro no checkout", { mensagem: "x" }, "https://l");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proj.supabase.co/functions/v1/alertas-criticos",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-alertas-secret": "segredo" },
        body: JSON.stringify({
          tipo: "checkout_erro",
          titulo: "Erro no checkout",
          detalhes: { mensagem: "x" },
          link: "https://l",
        }),
      },
    );
  });

  it("sem SUPABASE_URL ou ALERTAS_SECRET não tenta a rede (e não explode)", async () => {
    delete process.env.ALERTAS_SECRET;
    await expect(dispararAlerta("t", "x")).resolves.toBeUndefined();
    delete process.env.SUPABASE_URL;
    process.env.ALERTAS_SECRET = "s";
    await expect(dispararAlerta("t", "x")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha de rede é engolida", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(dispararAlerta("t", "x")).resolves.toBeUndefined();
  });
});
