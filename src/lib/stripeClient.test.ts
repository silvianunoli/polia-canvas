import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { loadStripeMock } = vi.hoisted(() => ({ loadStripeMock: vi.fn() }));

vi.mock("@stripe/stripe-js", () => ({ loadStripe: loadStripeMock }));

type Mod = typeof import("./stripeClient");

async function carregarModulo(chave: string): Promise<Mod> {
  // a promise memoizada é estado de módulo
  vi.resetModules();
  vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", chave);
  return import("./stripeClient");
}

describe("getStripe", () => {
  beforeEach(() => {
    loadStripeMock.mockResolvedValue({ fake: "stripe" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("carrega o Stripe com a chave publicável do ambiente", async () => {
    const { getStripe } = await carregarModulo("pk_test_123");
    await expect(getStripe()).resolves.toEqual({ fake: "stripe" });
    expect(loadStripeMock).toHaveBeenCalledWith("pk_test_123");
  });

  it("memoiza: chamadas seguidas devolvem a mesma promise e carregam uma vez só", async () => {
    const { getStripe } = await carregarModulo("pk_test_123");
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
    await a;
    expect(loadStripeMock).toHaveBeenCalledTimes(1);
  });

  // Sem chave (dev sem .env) o checkout fica desligado, não quebrado.
  it("sem chave configurada resolve null sem tentar carregar", async () => {
    const { getStripe } = await carregarModulo("");
    await expect(getStripe()).resolves.toBeNull();
    expect(loadStripeMock).not.toHaveBeenCalled();
  });
});
