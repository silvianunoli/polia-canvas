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

const { sessionsCreate, precoParaPlano, customersList, subscriptionsList, stripeClient } =
  vi.hoisted(() => ({
    sessionsCreate: vi.fn(),
    precoParaPlano: vi.fn((plano: string) => `price_${plano}`),
    customersList: vi.fn(),
    subscriptionsList: vi.fn(),
    stripeClient: vi.fn(),
  }));
vi.mock("@/lib/stripe.functions", () => ({ stripeClient, precoParaPlano }));

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
  customersList.mockReset();
  customersList.mockResolvedValue({ data: [] });
  subscriptionsList.mockReset();
  subscriptionsList.mockResolvedValue({ data: [] });
  stripeClient.mockReset();
  stripeClient.mockImplementation(() => ({
    checkout: { sessions: { create: sessionsCreate } },
    customers: { list: customersList },
    subscriptions: { list: subscriptionsList },
  }));
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
        success_url:
          "https://one.usepolia.com.br/compra-confirmada?plano=controle_mensal&session_id={CHECKOUT_SESSION_ID}",
        // Quem desiste volta pra /planos com o mesmo plano e ciclo escolhidos.
        cancel_url: "https://one.usepolia.com.br/planos?plano=premium&ciclo=mensal",
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

describe("iniciarCompraPublica: e-mail minúsculo (hook de convite compara lower)", () => {
  it("manda o e-mail minúsculo e sem espaço pro banco, pro Stripe e pro checkout", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    await comprar({
      data: { email: "  Ana.Souza@Exemplo.COM ", plano: "controle_mensal", turnstileToken: TOKEN },
    });
    expect(rpc).toHaveBeenCalledWith("buscar_user_id_por_email", {
      p_email: "ana.souza@exemplo.com",
    });
    expect(customersList).toHaveBeenCalledWith({ email: "ana.souza@exemplo.com", limit: 10 });
    expect(sessionsCreate.mock.calls[0][0].customer_email).toBe("ana.souza@exemplo.com");
  });
});

describe("iniciarCompraPublica: compra duplicada com webhook atrasado", () => {
  const base = { email: "ana@exemplo.com", plano: "projete_mensal", turnstileToken: TOKEN };

  it.each(["active", "trialing", "past_due"])(
    "banco sem assinatura, mas o Stripe já tem uma %s: recusa sem criar sessão",
    async (status) => {
      customersList.mockResolvedValue({ data: [{ id: "cus_a" }, { id: "cus_b" }] });
      subscriptionsList
        .mockResolvedValueOnce({ data: [{ status: "canceled" }] })
        .mockResolvedValueOnce({ data: [{ status }] });
      const r = await comprar({ data: base });
      expect(r).toEqual({ url: null, sessionId: null, error: ERRO_JA_ASSINA, jaAssina: true });
      expect(subscriptionsList).toHaveBeenCalledWith({
        customer: "cus_b",
        status: "all",
        limit: 20,
      });
      expect(sessionsCreate).not.toHaveBeenCalled();
    },
  );

  it("no Stripe só assinatura sem acesso: compra normalmente", async () => {
    customersList.mockResolvedValue({ data: [{ id: "cus_a" }] });
    subscriptionsList.mockResolvedValue({
      data: [{ status: "canceled" }, { status: "incomplete_expired" }],
    });
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({ data: base });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
  });

  it("falha na consulta ao Stripe não trava a venda (o webhook desfaz a duplicada)", async () => {
    customersList.mockRejectedValue(new Error("stripe fora"));
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    const r = await comprar({ data: base });
    expect(r).toEqual({ url: "https://checkout/1", sessionId: "cs_1", error: null });
  });

  it("banco já diz que assina: nem consulta o Stripe", async () => {
    rpc.mockResolvedValue({ data: "user-1", error: null });
    assinaturaLida.mockResolvedValue({ data: { status: "active" }, error: null });
    await comprar({ data: base });
    expect(customersList).not.toHaveBeenCalled();
  });
});

describe("iniciarCompraPublica: volta do Stripe e configuração", () => {
  it("cancel_url devolve plano, ciclo e origem de campanha pra /planos", async () => {
    sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout/1" });
    await comprar({
      data: {
        email: "ana@exemplo.com",
        plano: "projete_anual",
        turnstileToken: TOKEN,
        origemCampanha: { origem: "landing-a", utm_source: "meta" },
      },
    });
    const url = new URL(sessionsCreate.mock.calls[0][0].cancel_url);
    expect(url.pathname).toBe("/planos");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      plano: "pro",
      ciclo: "anual",
      origem: "landing-a",
      utm_source: "meta",
    });
  });

  it("Stripe sem configuração vira a mensagem da Pólia One e alerta, não erro técnico", async () => {
    stripeClient.mockImplementation(() => {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
    });
    const r = await comprar({
      data: { email: "ana@exemplo.com", plano: "controle_mensal", turnstileToken: TOKEN },
    });
    expect(r).toEqual({ url: null, sessionId: null, error: ERRO });
    expect(dispararAlerta).toHaveBeenCalledWith(
      "checkout_erro",
      expect.any(String),
      expect.objectContaining({ mensagem: expect.stringContaining("STRIPE_SECRET_KEY") }),
    );
  });
});
