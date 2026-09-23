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

import { iniciarCompraPublica } from "./compra-publica.functions";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const comprar = iniciarCompraPublica as unknown as Chamavel;

const ERRO = "Não conseguimos abrir o checkout agora. Tenta de novo.";

beforeEach(() => {
  sessionsCreate.mockReset();
  precoParaPlano.mockClear();
  dispararAlerta.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("iniciarCompraPublica: validação", () => {
  it("rejeita e-mail inválido antes de tocar no Stripe", async () => {
    await expect(comprar({ data: { email: "nao-e-email", plano: "mensal" } })).rejects.toThrow();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejeita plano fora de mensal/anual (o checkout público só vende o Premium)", async () => {
    await expect(
      comprar({ data: { email: "ana@exemplo.com", plano: "controle_mensal" } }),
    ).rejects.toThrow();
    await expect(
      comprar({ data: { email: "ana@exemplo.com", plano: "projete_anual" } }),
    ).rejects.toThrow();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("iniciarCompraPublica: sessão", () => {
  it("plano mensal vira controle_mensal e anual vira controle_anual", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });

    await comprar({ data: { email: "ana@exemplo.com", plano: "mensal" } });
    expect(precoParaPlano).toHaveBeenLastCalledWith("controle_mensal");
    expect(sessionsCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_controle_mensal", quantity: 1 }],
        metadata: { plano: "controle_mensal" },
      }),
    );

    await comprar({ data: { email: "ana@exemplo.com", plano: "anual" } });
    expect(precoParaPlano).toHaveBeenLastCalledWith("controle_anual");
    expect(sessionsCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ metadata: { plano: "controle_anual" } }),
    );
  });

  it("sucesso devolve url, sessionId e error nulo, com as URLs de retorno do site", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({ data: { email: "  ana@exemplo.com ", plano: "mensal" } });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        // trim do Zod: espaço em volta não vira e-mail diferente no Stripe.
        customer_email: "ana@exemplo.com",
        success_url: "https://one.usepolia.com.br/compra-confirmada",
        cancel_url: "https://one.usepolia.com.br/#planos",
        allow_promotion_codes: true,
      }),
    );
  });

  it("sessão sem URL devolve a mensagem de erro sem alerta (não é exceção)", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: null });
    const r = await comprar({ data: { email: "ana@exemplo.com", plano: "mensal" } });
    expect(r).toEqual({ url: null, sessionId: null, error: ERRO });
    expect(dispararAlerta).not.toHaveBeenCalled();
  });

  it("exceção devolve a mesma mensagem e dispara checkout_erro pro Telegram", async () => {
    sessionsCreate.mockRejectedValue(new Error("rate limited"));
    const r = await comprar({ data: { email: "ana@exemplo.com", plano: "anual" } });
    expect(r).toEqual({ url: null, sessionId: null, error: ERRO });
    expect(dispararAlerta).toHaveBeenCalledWith(
      "checkout_erro",
      expect.any(String),
      expect.objectContaining({ mensagem: "rate limited" }),
    );
  });
});
