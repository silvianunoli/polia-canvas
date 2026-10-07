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

const { rpc, assinaturaLida } = vi.hoisted(() => ({
  rpc: vi.fn(),
  assinaturaLida: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: assinaturaLida }) }),
    }),
  },
}));

import { iniciarCompraPublica, ERRO_JA_ASSINA } from "./compra-publica.functions";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const comprar = iniciarCompraPublica as unknown as Chamavel;

const ERRO = "A Pólia One não conseguiu abrir o checkout agora. Tenta de novo.";
const ERRO_ROBO = "Confirma que não é um robô e tenta de novo.";
const TOKEN = "token-turnstile";

beforeEach(() => {
  sessionsCreate.mockReset();
  precoParaPlano.mockClear();
  dispararAlerta.mockReset();
  verificarTurnstileServer.mockReset();
  verificarTurnstileServer.mockResolvedValue(true);
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  assinaturaLida.mockReset();
  assinaturaLida.mockResolvedValue({ data: null, error: null });
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

describe("iniciarCompraPublica: origem de campanha", () => {
  const base = { email: "ana@exemplo.com", plano: "controle_mensal", turnstileToken: TOKEN };

  it("sem origem, a sessão sai igual à de antes (sem subscription_data)", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    await comprar({ data: base });
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.metadata).toEqual({ plano: "controle_mensal" });
    expect(args).not.toHaveProperty("subscription_data");
  });

  it("grava landing e UTMs válidas na sessão e na assinatura", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const origemCampanha = {
      origem: "landing-a",
      utm_source: "meta",
      utm_campaign: "Abertura | Orçamento",
      utm_content: "120212345678901234",
    };
    await comprar({ data: { ...base, origemCampanha } });
    const args = sessionsCreate.mock.calls[0][0];
    expect(args.metadata).toEqual({ plano: "controle_mensal", ...origemCampanha });
    expect(args.subscription_data).toEqual({ metadata: origemCampanha });
  });

  it("descarta valor fora da allowlist e chave desconhecida, sem travar a compra", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({
      data: {
        ...base,
        origemCampanha: {
          origem: "<script>alert(1)</script>",
          utm_source: "meta",
          plano: "projete_anual",
          email: "outra@exemplo.com",
        },
      },
    });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
    const args = sessionsCreate.mock.calls[0][0];
    // plano vindo da origem não sobrescreve o plano escolhido.
    expect(args.metadata).toEqual({ plano: "controle_mensal", utm_source: "meta" });
    expect(args.subscription_data).toEqual({ metadata: { utm_source: "meta" } });
  });

  it("origem em formato errado é ignorada, não derruba a validação", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({ data: { ...base, origemCampanha: "landing-a" } });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
    expect(sessionsCreate.mock.calls[0][0].metadata).toEqual({ plano: "controle_mensal" });
  });
});

describe("iniciarCompraPublica: e-mail que já assina (QA-04)", () => {
  it.each(["active", "trialing", "past_due"])(
    "assinatura %s: recusa sem criar sessão e sinaliza jaAssina",
    async (status) => {
      rpc.mockResolvedValue({ data: "user-1", error: null });
      assinaturaLida.mockResolvedValue({ data: { status }, error: null });
      const r = await comprar({
        data: { email: "ana@exemplo.com", plano: "projete_mensal", turnstileToken: TOKEN },
      });
      expect(r).toEqual({ url: null, sessionId: null, error: ERRO_JA_ASSINA, jaAssina: true });
      expect(rpc).toHaveBeenCalledWith("buscar_user_id_por_email", { p_email: "ana@exemplo.com" });
      expect(sessionsCreate).not.toHaveBeenCalled();
    },
  );

  it.each(["canceled", "incomplete", "incomplete_expired"])(
    "assinatura %s não bloqueia a compra",
    async (status) => {
      rpc.mockResolvedValue({ data: "user-1", error: null });
      assinaturaLida.mockResolvedValue({ data: { status }, error: null });
      sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
      const r = await comprar({
        data: { email: "ana@exemplo.com", plano: "controle_mensal", turnstileToken: TOKEN },
      });
      expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
    },
  );

  it("conta sem assinatura (Grátis) compra normalmente", async () => {
    rpc.mockResolvedValue({ data: "user-1", error: null });
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({
      data: { email: "ana@exemplo.com", plano: "controle_mensal", turnstileToken: TOKEN },
    });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
  });

  it("falha na leitura não trava a venda", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({
      data: { email: "ana@exemplo.com", plano: "controle_mensal", turnstileToken: TOKEN },
    });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
  });

  it("sem Turnstile válido nem consulta o banco", async () => {
    verificarTurnstileServer.mockResolvedValue(false);
    await comprar({ data: { email: "ana@exemplo.com", plano: "controle_mensal" } });
    expect(rpc).not.toHaveBeenCalled();
  });
});
