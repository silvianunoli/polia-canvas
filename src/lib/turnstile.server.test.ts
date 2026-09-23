import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verificarTurnstileServer } from "./turnstile.server";

// O gate é fail-closed: na dúvida, barra. Cada caminho de falha abaixo tem que
// devolver false, e só `success: true` vindo do Worker libera.

const fetchMock = vi.fn();
const URL_VERIFY = "https://turnstile.exemplo.workers.dev/verify";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_TURNSTILE_VERIFY_URL", URL_VERIFY);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("verificarTurnstileServer", () => {
  it("bloqueia sem token, sem nem chamar a rede", async () => {
    expect(await verificarTurnstileServer(undefined)).toBe(false);
    expect(await verificarTurnstileServer(null)).toBe(false);
    expect(await verificarTurnstileServer("")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloqueia quando a URL de verificação não está configurada", async () => {
    vi.stubEnv("VITE_TURNSTILE_VERIFY_URL", "");
    expect(await verificarTurnstileServer("tok")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloqueia quando a rede falha", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    expect(await verificarTurnstileServer("tok")).toBe(false);
  });

  it("bloqueia quando a resposta não é JSON", async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.reject(new SyntaxError("html")) });
    expect(await verificarTurnstileServer("tok")).toBe(false);
  });

  it("bloqueia quando o Worker responde success: false ou sem success", async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({ success: false }) });
    expect(await verificarTurnstileServer("tok")).toBe(false);
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({}) });
    expect(await verificarTurnstileServer("tok")).toBe(false);
  });

  it("libera só com success: true, mandando o token em POST JSON", async () => {
    fetchMock.mockResolvedValue({ json: () => Promise.resolve({ success: true }) });
    expect(await verificarTurnstileServer("tok-123")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(URL_VERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok-123" }),
    });
  });
});
