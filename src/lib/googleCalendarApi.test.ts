import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  montarUrlConsentimento,
  trocarCodigoPorTokens,
  renovarAccessToken,
  buscarEmailConectado,
  listarEventosGoogle,
  revogarToken,
} from "./googleCalendarApi";

const CREDS_OK = {
  GOOGLE_CALENDAR_CLIENT_ID: "client-123",
  GOOGLE_CALENDAR_CLIENT_SECRET: "secret-abc",
  GOOGLE_CALENDAR_REDIRECT_URI: "https://polia.app/oauth/google/callback",
};

function setCredenciais(vars: Partial<typeof CREDS_OK> | null) {
  if (vars === null) {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    return;
  }
  Object.assign(process.env, vars);
}

describe("montarUrlConsentimento", () => {
  afterEach(() => setCredenciais(null));

  it("monta a URL de consentimento do Google com os parâmetros obrigatórios", () => {
    setCredenciais(CREDS_OK);
    const { url, error } = montarUrlConsentimento("state-xyz");
    expect(error).toBeNull();
    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth?");
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("state=state-xyz");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
  });

  it("retorna erro amigável quando faltam credenciais no ambiente", () => {
    setCredenciais(null);
    const { url, error } = montarUrlConsentimento("state-xyz");
    expect(url).toBeNull();
    expect(error).toBe("A integração com o Google ainda não está configurada.");
  });

  it("retorna erro quando só parte das credenciais está presente", () => {
    setCredenciais({ GOOGLE_CALENDAR_CLIENT_ID: "client-123" });
    const { url, error } = montarUrlConsentimento("state-xyz");
    expect(url).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("chamadas HTTP ao Google (fetch mockado)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setCredenciais(CREDS_OK);
  });

  afterEach(() => {
    setCredenciais(null);
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("trocarCodigoPorTokens", () => {
    it("retorna os tokens quando o Google responde 200", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
      }) as unknown as typeof fetch;

      const { tokens, error } = await trocarCodigoPorTokens("code-1");
      expect(error).toBeNull();
      expect(tokens).toEqual({ access_token: "at", refresh_token: "rt", expires_in: 3600 });
    });

    it("retorna erro amigável quando o Google responde não-2xx", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "invalid_grant",
      }) as unknown as typeof fetch;
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { tokens, error } = await trocarCodigoPorTokens("code-invalido");
      expect(tokens).toBeNull();
      expect(error).toBe("Não conseguimos confirmar a conexão com o Google. Tenta de novo.");
    });

    it("retorna erro de falha de conexão quando fetch rejeita (rede fora)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { tokens, error } = await trocarCodigoPorTokens("code-1");
      expect(tokens).toBeNull();
      expect(error).toBe("Falha de conexão com o Google.");
    });

    it("retorna erro de configuração sem nem chamar fetch quando faltam credenciais", async () => {
      setCredenciais(null);
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const { tokens, error } = await trocarCodigoPorTokens("code-1");
      expect(tokens).toBeNull();
      expect(error).toBe("A integração com o Google ainda não está configurada.");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("renovarAccessToken", () => {
    it("retorna access_token e expires_in quando o Google renova com sucesso", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "novo-at", expires_in: 3600 }),
      }) as unknown as typeof fetch;

      const resultado = await renovarAccessToken("refresh-token-valido");
      expect(resultado).toEqual({ access_token: "novo-at", expires_in: 3600 });
    });

    it("retorna null quando o refresh token foi revogado (Google responde não-2xx)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "invalid_grant",
      }) as unknown as typeof fetch;
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(await renovarAccessToken("refresh-revogado")).toBeNull();
    });

    it("retorna null quando fetch lança exceção", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("timeout"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(await renovarAccessToken("qualquer")).toBeNull();
    });
  });

  describe("buscarEmailConectado", () => {
    it("retorna o email quando o Google responde com sucesso", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ email: "aimer@exemplo.com" }),
      }) as unknown as typeof fetch;

      expect(await buscarEmailConectado("access-token")).toBe("aimer@exemplo.com");
    });

    it("retorna null quando a resposta não é ok", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
      expect(await buscarEmailConectado("access-token")).toBeNull();
    });

    it("retorna null quando o payload não tem campo email", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }) as unknown as typeof fetch;
      expect(await buscarEmailConectado("access-token")).toBeNull();
    });

    it("retorna null quando fetch lança exceção", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("timeout"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await buscarEmailConectado("access-token")).toBeNull();
    });
  });

  describe("listarEventosGoogle", () => {
    it("mapeia eventos com horário definido (diaTodo: false)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: "ev1",
              summary: "Reunião",
              htmlLink: "https://calendar.google.com/ev1",
              start: { dateTime: "2026-07-10T12:00:00Z" },
              end: { dateTime: "2026-07-10T13:00:00Z" },
            },
          ],
        }),
      }) as unknown as typeof fetch;

      const { eventos, error, expirado } = await listarEventosGoogle(
        "at",
        "2026-07-01T00:00:00Z",
        "2026-07-31T23:59:59Z",
      );
      expect(error).toBeNull();
      expect(expirado).toBe(false);
      expect(eventos).toEqual([
        {
          id: "ev1",
          titulo: "Reunião",
          inicio: "2026-07-10T12:00:00Z",
          fim: "2026-07-10T13:00:00Z",
          diaTodo: false,
          link: "https://calendar.google.com/ev1",
        },
      ]);
    });

    it("marca diaTodo: true quando o evento só tem 'date' (sem dateTime)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: "ev2", start: { date: "2026-07-10" }, end: { date: "2026-07-11" } }],
        }),
      }) as unknown as typeof fetch;

      const { eventos } = await listarEventosGoogle("at", "x", "y");
      expect(eventos?.[0].diaTodo).toBe(true);
    });

    it("usa '(sem título)' quando o evento não tem summary", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: "ev3", start: { date: "2026-07-10" }, end: { date: "2026-07-11" } }],
        }),
      }) as unknown as typeof fetch;

      const { eventos } = await listarEventosGoogle("at", "x", "y");
      expect(eventos?.[0].titulo).toBe("(sem título)");
    });

    it("descarta eventos sem start ou sem end", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: "sem-start", end: { date: "2026-07-11" } },
            { id: "sem-end", start: { date: "2026-07-10" } },
          ],
        }),
      }) as unknown as typeof fetch;

      const { eventos } = await listarEventosGoogle("at", "x", "y");
      expect(eventos).toEqual([]);
    });

    it("marca expirado: true quando o Google responde 401 (access token vencido)", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

      const { eventos, error, expirado } = await listarEventosGoogle("at-vencido", "x", "y");
      expect(expirado).toBe(true);
      expect(eventos).toBeNull();
      expect(error).toBeNull();
    });

    it("retorna erro amigável pra outros status de falha (ex.: 500)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "server error",
      }) as unknown as typeof fetch;
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { eventos, error, expirado } = await listarEventosGoogle("at", "x", "y");
      expect(expirado).toBe(false);
      expect(eventos).toBeNull();
      expect(error).toBe("Não conseguimos buscar os eventos do Google agora.");
    });

    it("retorna erro de conexão quando fetch lança exceção", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("timeout"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      const { eventos, error, expirado } = await listarEventosGoogle("at", "x", "y");
      expect(eventos).toBeNull();
      expect(expirado).toBe(false);
      expect(error).toBe("Falha de conexão com o Google.");
    });
  });

  describe("revogarToken", () => {
    it("chama o endpoint de revogação com o token", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      await revogarToken("token-a-revogar");
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("token=token-a-revogar"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("não lança exceção quando fetch falha (revogação é best-effort)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(revogarToken("token")).resolves.toBeUndefined();
    });
  });
});
