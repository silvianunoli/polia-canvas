import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setCookieConsent } from "./cookieConsent";

const { getSessionMock, insertMock, fromMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  insertMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: getSessionMock }, from: fromMock },
}));

const { track } = await import("./analytics");

describe("track", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fromMock.mockReturnValue({ insert: insertMock });
    insertMock.mockResolvedValue({ error: null });
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // LGPD: sem aceite explícito de cookies de análise, nada é gravado.
  it("não grava nada sem consentimento de analytics", async () => {
    await track("pageview");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("não grava com consentimento só 'essential'", async () => {
    setCookieConsent("essential");
    await track("pageview");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("com consentimento, grava evento, página, sessão, usuária e propriedades", async () => {
    setCookieConsent("accepted");
    await track("cta_click", { onde: "hero" });
    expect(fromMock).toHaveBeenCalledWith("eventos_analytics");
    expect(insertMock).toHaveBeenCalledWith({
      evento: "cta_click",
      pagina: "/",
      sessao_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      user_id: "u1",
      propriedades: { onde: "hero" },
    });
  });

  it("propriedades ausentes viram objeto vazio e visitante anônima tem user_id null", async () => {
    setCookieConsent("accepted");
    getSessionMock.mockResolvedValue({ data: { session: null } });
    await track("pageview");
    expect(insertMock.mock.calls[0][0]).toMatchObject({ user_id: null, propriedades: {} });
  });

  it("reaproveita o mesmo id de sessão (sessionStorage) entre eventos", async () => {
    setCookieConsent("accepted");
    await track("a");
    await track("b");
    const [a, b] = insertMock.mock.calls.map((c) => c[0].sessao_id);
    expect(a).toBe(b);
    expect(sessionStorage.getItem("polia-sessao-analytics")).toBe(a);
  });

  it("falha do insert não vira erro pra usuária", async () => {
    setCookieConsent("accepted");
    insertMock.mockRejectedValue(new Error("rede"));
    await expect(track("x")).resolves.toBeUndefined();
  });
});
