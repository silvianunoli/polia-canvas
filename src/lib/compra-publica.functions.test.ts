import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { sessionsCreate, precoParaPlano } = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  precoParaPlano: vi.fn((plano: string) => `price_${plano}`),
}));
vi.mock("@/lib/stripe.functions", () => ({
  stripeClient: () => ({ checkout: { sessions: { create: sessionsCreate } } }),
  precoParaPlano,
}));

const { dispararAlerta } = vi.hoisted(() => ({ dispararAlerta: vi.fn() }));
vi.mock("@/lib/alertas.server", () => ({ dispararAlerta }));

const { verificarTurnstileServer } = vi.hoisted(() => ({ verificarTurnstileServer: vi.fn() }));
vi.mock("@/lib/turnstile.server", () => ({ verificarTurnstileServer }));

import { iniciarCompraPublica } from "./compra-publica.functions";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const comprar = iniciarCompraPublica as unknown as Chamavel;

const ERRO = "A Pólia não conseguiu abrir o checkout agora. Tenta de novo.";
const ERRO_ROBO = "Confirma que não é um robô e tenta de novo.";
const TOKEN = "token-turnstile";

beforeEach(() => {
  sessionsCreate.mockReset();
  precoParaPlano.mockClear();
  dispararAlerta.mockReset();
  verificarTurnstileServer.mockReset();
  verificarTurnstileServer.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("iniciarCompraPublica: validação", () => {
  it("rejeita e-mail inválido antes de tocar no Stripe", async () => {
    await expect(
      comprar({ data: { email: "nao-e-email", plano: "controle_mensal", turnstileToken: TOKEN } }),
    ).rejects.toThrow();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejeita plano fora dos quatro pagos (inclui o antigo mensal/anual solto)", async () => {
    await expect(
      comprar({ data: { email: "ana@exemplo.com", plano: "mensal", turnstileToken: TOKEN } }),
    ).rejects.toThrow();
    await expect(
      comprar({ data: { email: "ana@exemplo.com", plano: "confere", turnstileToken: TOKEN } }),
    ).rejects.toThrow();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("iniciarCompraPublica: anti-robô", () => {
  it("sem Turnstile válido não cria sessão no Stripe", async () => {
    verificarTurnstileServer.mockResolvedValue(false);
    const r = await comprar({
      data: { email: "ana@exemplo.com", plano: "controle_mensal" },
    });
    expect(r).toEqual({ url: null, sessionId: null, error: ERRO_ROBO });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(precoParaPlano).not.toHaveBeenCalled();
  });

  it("repassa o token ao servidor do Turnstile", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    await comprar({
      data: { email: "ana@exemplo.com", plano: "controle_mensal", turnstileToken: TOKEN },
    });
    expect(verificarTurnstileServer).toHaveBeenCalledWith(TOKEN);
  });

  it("honeypot preenchido devolve erro genérico sem validar token nem tocar no Stripe", async () => {
    const r = await comprar({
      data: {
        email: "ana@exemplo.com",
        plano: "controle_mensal",
        turnstileToken: TOKEN,
        hp: "preenchido por bot",
      },
    });
    expect(r).toEqual({ url: null, sessionId: null, error: ERRO });
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("iniciarCompraPublica: sessão", () => {
  it.each(["controle_mensal", "controle_anual", "projete_mensal", "projete_anual"] as const)(
    "plano %s usa o price id dele e grava o plano no metadata",
    async (plano) => {
      sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });

      await comprar({ data: { email: "ana@exemplo.com", plano, turnstileToken: TOKEN } });

      expect(precoParaPlano).toHaveBeenLastCalledWith(plano);
      expect(sessionsCreate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          line_items: [{ price: `price_${plano}`, quantity: 1 }],
          metadata: { plano },
        }),
      );
    },
  );

  it("sucesso devolve url, sessionId e error nulo, com as URLs de retorno do site", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({
      data: { email: "  ana@exemplo.com ", plano: "controle_mensal", turnstileToken: TOKEN },
    });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        // trim do Zod: espaço em volta não vira e-mail diferente no Stripe.
        customer_email: "ana@exemplo.com",
        success_url: "https://one.usepolia.com.br/compra-confirmada",
        // Quem desiste volta pra tela de escolha de plano, não pra um âncora da home.
        cancel_url: "https://one.usepolia.com.br/planos",
        allow_promotion_codes: true,
      }),
    );
  });

  it("sessão sem URL devolve a mensagem de erro sem alerta (não é exceção)", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: null });
    const r = await comprar({
      data: { email: "ana@exemplo.com", plano: "controle_mensal", turnstileToken: TOKEN },
    });
    expect(r).toEqual({ url: null, sessionId: null, error: ERRO });
    expect(dispararAlerta).not.toHaveBeenCalled();
  });

  it("exceção devolve a mesma mensagem e dispara checkout_erro pro Telegram", async () => {
    sessionsCreate.mockRejectedValue(new Error("rate limited"));
    const r = await comprar({
      data: { email: "ana@exemplo.com", plano: "projete_anual", turnstileToken: TOKEN },
    });
    expect(r).toEqual({ url: null, sessionId: null, error: ERRO });
    expect(dispararAlerta).toHaveBeenCalledWith(
      "checkout_erro",
      expect.any(String),
      expect.objectContaining({ mensagem: "rate limited" }),
    );
  });
});
