import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Os price ids são lidos do env NA CARGA do módulo (ENV_PRICE_POR_PLANO é uma
// constante de topo), então precisam existir antes do import lá embaixo.
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  process.env.STRIPE_PRICE_ID_CONTROLE_MENSAL = "price_controle_mensal";
  process.env.STRIPE_PRICE_ID_CONTROLE_ANUAL = "price_controle_anual";
  process.env.STRIPE_PRICE_ID_PROJETE_MENSAL = "price_projete_mensal";
  process.env.STRIPE_PRICE_ID_PROJETE_ANUAL = "price_projete_anual";
});

// createServerFn vira um builder de mentira: guarda o validador e devolve o
// handler como função comum, recebendo { data, context } direto do teste.
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
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const stripeMock = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  subscriptions: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() },
  billingPortal: { sessions: { create: vi.fn() } },
}));
vi.mock("stripe", () => ({
  default: class {
    static createFetchHttpClient() {
      return {};
    }
    constructor() {
      return stripeMock;
    }
  },
}));

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

const { dispararAlerta } = vi.hoisted(() => ({ dispararAlerta: vi.fn() }));
vi.mock("@/lib/alertas.server", () => ({ dispararAlerta }));

import {
  precoParaPlano,
  iniciarAssinatura,
  statusAssinatura,
  abrirPortalCobranca,
  cancelarAssinatura,
} from "./stripe.functions";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const iniciar = iniciarAssinatura as unknown as Chamavel;
const status = statusAssinatura as unknown as Chamavel;
const portal = abrirPortalCobranca as unknown as Chamavel;
const cancelar = cancelarAssinatura as unknown as Chamavel;

// Builder encadeável do supabase-js: todo método devolve o próprio objeto e o
// `await` resolve no resultado combinado.
const METODOS = ["select", "eq", "maybeSingle", "upsert", "update"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const context = { userId: "u-1", claims: { email: "ana@exemplo.com" } };

beforeEach(() => {
  from.mockReset();
  dispararAlerta.mockReset();
  stripeMock.customers.create.mockReset();
  stripeMock.subscriptions.create.mockReset();
  stripeMock.subscriptions.update.mockReset();
  stripeMock.subscriptions.retrieve.mockReset();
  stripeMock.subscriptions.cancel.mockReset();
  stripeMock.billingPortal.sessions.create.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("precoParaPlano", () => {
  it("mapeia cada chave interna pra env var certa", () => {
    expect(precoParaPlano("controle_mensal")).toBe("price_controle_mensal");
    expect(precoParaPlano("controle_anual")).toBe("price_controle_anual");
    expect(precoParaPlano("projete_mensal")).toBe("price_projete_mensal");
    expect(precoParaPlano("projete_anual")).toBe("price_projete_anual");
  });

  it("explode com mensagem clara quando o price id do plano não está no env", async () => {
    // O mapa é lido na carga do módulo: precisa recarregar sem a variável.
    vi.resetModules();
    const salvo = process.env.STRIPE_PRICE_ID_PROJETE_ANUAL;
    delete process.env.STRIPE_PRICE_ID_PROJETE_ANUAL;
    try {
      const mod = await import("./stripe.functions");
      expect(() => mod.precoParaPlano("projete_anual")).toThrow(
        'Missing price id for plano "projete_anual".',
      );
      expect(() => mod.precoParaPlano("controle_mensal")).not.toThrow();
    } finally {
      process.env.STRIPE_PRICE_ID_PROJETE_ANUAL = salvo;
    }
  });
});

describe("stripeClient", () => {
  it("explode sem STRIPE_SECRET_KEY em vez de criar cliente vazio", async () => {
    vi.resetModules();
    const salvo = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const mod = await import("./stripe.functions");
      expect(() => mod.stripeClient()).toThrow("Missing STRIPE_SECRET_KEY");
    } finally {
      process.env.STRIPE_SECRET_KEY = salvo;
    }
  });
});

describe("iniciarAssinatura", () => {
  const subscriptionOk = {
    id: "sub_1",
    status: "incomplete",
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1_800_000_000 }] },
    latest_invoice: { confirmation_secret: { client_secret: "pi_secret" } },
  };

  it("rejeita plano fora do enum antes de tocar em banco ou Stripe", async () => {
    await expect(iniciar({ data: { plano: "premium" }, context })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it("bloqueia quando já existe assinatura ativa (não cobra duas vezes)", async () => {
    from.mockReturnValueOnce(consulta({ data: { stripe_customer_id: "cus_1", status: "active" } }));
    const r = await iniciar({ data: { plano: "controle_mensal" }, context });
    expect(r).toEqual({ clientSecret: null, error: "Você já tem uma assinatura ativa." });
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });

  it("past_due e trialing também contam como ativa", async () => {
    for (const st of ["past_due", "trialing"]) {
      from.mockReturnValueOnce(consulta({ data: { stripe_customer_id: "cus_1", status: st } }));
      const r = (await iniciar({ data: { plano: "controle_mensal" }, context })) as {
        error: string | null;
      };
      expect(r.error).toBe("Você já tem uma assinatura ativa.");
    }
  });

  it("cria customer com e-mail das claims quando a usuária nunca pagou", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    const upsert = consulta({ error: null });
    from.mockReturnValueOnce(upsert);
    stripeMock.customers.create.mockResolvedValue({ id: "cus_novo" });
    stripeMock.subscriptions.create.mockResolvedValue(subscriptionOk);

    const r = await iniciar({ data: { plano: "projete_anual" }, context });

    expect(stripeMock.customers.create).toHaveBeenCalledWith(
      { email: "ana@exemplo.com", metadata: { user_id: "u-1" } },
      { idempotencyKey: expect.stringMatching(/^polia-cliente-u-1-\d+$/) },
    );
    expect(stripeMock.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_novo",
        items: [{ price: "price_projete_anual" }],
        payment_behavior: "default_incomplete",
        // Sem o caminho inteiro o Stripe não devolve o confirmation_secret.
        expand: ["latest_invoice.confirmation_secret"],
      }),
      { idempotencyKey: expect.stringMatching(/^polia-assinatura-u-1-projete_anual-nenhuma-\d+$/) },
    );
    expect(upsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u-1",
        stripe_customer_id: "cus_novo",
        stripe_subscription_id: "sub_1",
        price_id: "price_projete_anual",
        status: "incomplete",
        current_period_end: new Date(1_800_000_000 * 1000).toISOString(),
      }),
      { onConflict: "user_id" },
    );
    expect(r).toEqual({ clientSecret: "pi_secret", error: null });
  });

  it("reaproveita o customer de uma assinatura antiga cancelada", async () => {
    from.mockReturnValueOnce(
      consulta({ data: { stripe_customer_id: "cus_velho", status: "canceled" } }),
    );
    from.mockReturnValueOnce(consulta({ error: null }));
    stripeMock.subscriptions.create.mockResolvedValue(subscriptionOk);

    await iniciar({ data: { plano: "controle_mensal" }, context });

    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_velho" }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("devolve erro genérico quando não consegue salvar a assinatura local", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    from.mockReturnValueOnce(consulta({ error: { message: "boom" } }));
    stripeMock.customers.create.mockResolvedValue({ id: "cus_1" });
    stripeMock.subscriptions.create.mockResolvedValue(subscriptionOk);

    const r = await iniciar({ data: { plano: "controle_mensal" }, context });
    expect(r).toEqual({
      clientSecret: null,
      error: "A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.",
    });
  });

  it("fatura sem client_secret devolve erro de pagamento, não secret nulo silencioso", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    from.mockReturnValueOnce(consulta({ error: null }));
    stripeMock.customers.create.mockResolvedValue({ id: "cus_1" });
    stripeMock.subscriptions.create.mockResolvedValue({
      ...subscriptionOk,
      latest_invoice: "in_string_sem_expand",
    });

    const r = await iniciar({ data: { plano: "controle_mensal" }, context });
    expect(r).toEqual({
      clientSecret: null,
      error: "A Pólia One não conseguiu preparar o pagamento agora. Tenta de novo.",
    });
  });

  it("exceção do Stripe dispara alerta checkout_erro e devolve erro genérico", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    stripeMock.customers.create.mockRejectedValue(new Error("card_declined"));

    const r = await iniciar({ data: { plano: "controle_mensal" }, context });
    expect(r).toEqual({
      clientSecret: null,
      error: "A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.",
    });
    expect(dispararAlerta).toHaveBeenCalledWith(
      "checkout_erro",
      expect.any(String),
      expect.objectContaining({ mensagem: "card_declined" }),
    );
  });

  // DINHEIRO (08/10/2026): o "incomplete" local pode estar velho (webhook
  // atrasado). Cancelar sem conferir no Stripe derrubava assinatura paga.
  describe("tentativa anterior marcada como incompleta no banco", () => {
    const linhaIncompleta = {
      data: {
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_velha",
        status: "incomplete",
        price_id: "price_controle_mensal",
        current_period_end: null,
        cancel_at_period_end: false,
      },
    };

    it.each(["active", "trialing", "past_due"])(
      "no Stripe já está %s: NÃO cancela, não cria outra e espelha a linha local",
      async (st) => {
        from.mockReturnValueOnce(consulta(linhaIncompleta));
        const update = consulta({ error: null });
        from.mockReturnValueOnce(update);
        stripeMock.subscriptions.retrieve.mockResolvedValue({
          id: "sub_velha",
          status: st,
          cancel_at_period_end: false,
          items: {
            data: [{ current_period_end: 1_800_000_000, price: { id: "price_controle_mensal" } }],
          },
        });

        const r = await iniciar({ data: { plano: "controle_mensal" }, context });

        expect(r).toEqual({
          clientSecret: null,
          error: "A Pólia One já encontrou uma assinatura ativa nessa conta.",
        });
        expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_velha");
        expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
        expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
        expect(update.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: st, price_id: "price_controle_mensal" }),
        );
        expect(update.eq).toHaveBeenCalledWith("user_id", "u-1");
      },
    );

    it("no Stripe ainda incompleta: cancela e abre outra com chave nova", async () => {
      from.mockReturnValueOnce(consulta(linhaIncompleta));
      from.mockReturnValueOnce(consulta({ error: null }));
      stripeMock.subscriptions.retrieve.mockResolvedValue({ id: "sub_velha", status: "incomplete" });
      stripeMock.subscriptions.create.mockResolvedValue(subscriptionOk);

      const r = await iniciar({ data: { plano: "controle_mensal" }, context });

      expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith("sub_velha");
      expect(stripeMock.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_1" }),
        {
          idempotencyKey: expect.stringMatching(
            /^polia-assinatura-u-1-controle_mensal-sub_velha-\d+$/,
          ),
        },
      );
      expect(r).toEqual({ clientSecret: "pi_secret", error: null });
    });

    it("no Stripe já expirou: não cancela e abre outra", async () => {
      from.mockReturnValueOnce(consulta(linhaIncompleta));
      from.mockReturnValueOnce(consulta({ error: null }));
      stripeMock.subscriptions.retrieve.mockResolvedValue({
        id: "sub_velha",
        status: "incomplete_expired",
      });
      stripeMock.subscriptions.create.mockResolvedValue(subscriptionOk);

      const r = await iniciar({ data: { plano: "controle_mensal" }, context });
      expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
      expect(r).toEqual({ clientSecret: "pi_secret", error: null });
    });

    it("não existe mais no Stripe (404): segue sem cancelar", async () => {
      from.mockReturnValueOnce(consulta(linhaIncompleta));
      from.mockReturnValueOnce(consulta({ error: null }));
      stripeMock.subscriptions.retrieve.mockRejectedValue(
        Object.assign(new Error("No such subscription"), {
          code: "resource_missing",
          statusCode: 404,
        }),
      );
      stripeMock.subscriptions.create.mockResolvedValue(subscriptionOk);

      const r = await iniciar({ data: { plano: "controle_mensal" }, context });
      expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
      expect(r).toEqual({ clientSecret: "pi_secret", error: null });
    });

    it("falha ao ler no Stripe: não cancela, não cria, devolve erro e alerta", async () => {
      from.mockReturnValueOnce(consulta(linhaIncompleta));
      stripeMock.subscriptions.retrieve.mockRejectedValue(new Error("timeout"));

      const r = await iniciar({ data: { plano: "controle_mensal" }, context });
      expect(r).toEqual({
        clientSecret: null,
        error: "A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.",
      });
      expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
      expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
      expect(dispararAlerta).toHaveBeenCalledWith(
        "checkout_erro",
        expect.any(String),
        expect.objectContaining({ mensagem: "timeout" }),
      );
    });
  });

  it("clique duplo: as duas chamadas usam a mesma chave de idempotência", async () => {
    for (let i = 0; i < 2; i++) {
      from.mockReturnValueOnce(consulta({ data: null }));
      from.mockReturnValueOnce(consulta({ error: null }));
    }
    stripeMock.customers.create.mockResolvedValue({ id: "cus_novo" });
    stripeMock.subscriptions.create.mockResolvedValue(subscriptionOk);

    await iniciar({ data: { plano: "controle_mensal" }, context });
    await iniciar({ data: { plano: "controle_mensal" }, context });

    const [c1, c2] = stripeMock.customers.create.mock.calls;
    expect(c1[1].idempotencyKey).toBe(c2[1].idempotencyKey);
    const [s1, s2] = stripeMock.subscriptions.create.mock.calls;
    expect(s1[1].idempotencyKey).toBe(s2[1].idempotencyKey);
    expect(s1[1].idempotencyKey).toMatch(/^polia-assinatura-u-1-controle_mensal-nenhuma-\d+$/);
  });

  it("sem STRIPE_SECRET_KEY devolve a mensagem da Pólia One, não erro técnico", async () => {
    vi.resetModules();
    const salvo = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const mod = await import("./stripe.functions");
      from.mockReturnValueOnce(consulta({ data: null }));
      const r = await (mod.iniciarAssinatura as unknown as Chamavel)({
        data: { plano: "controle_mensal" },
        context,
      });
      expect(r).toEqual({
        clientSecret: null,
        error: "A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.",
      });
      expect(dispararAlerta).toHaveBeenCalledWith(
        "checkout_erro",
        expect.any(String),
        expect.objectContaining({ mensagem: expect.stringContaining("STRIPE_SECRET_KEY") }),
      );
    } finally {
      process.env.STRIPE_SECRET_KEY = salvo;
    }
  });
});

describe("statusAssinatura", () => {
  it("sem linha devolve tudo zerado e sem cobrança", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    expect(await status({ context })).toEqual({
      ativa: false,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      preco: null,
      temCobranca: false,
    });
  });

  it("resolve o preço pelo price id conhecido e marca cobrança pelo customer", async () => {
    from.mockReturnValueOnce(
      consulta({
        data: {
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
          status: "active",
          current_period_end: "2026-10-01T00:00:00.000Z",
          cancel_at_period_end: true,
          price_id: "price_projete_mensal",
        },
      }),
    );
    expect(await status({ context })).toEqual({
      ativa: true,
      status: "active",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      cancelAtPeriodEnd: true,
      preco: { valorCentavos: 4790, intervalo: "month", tier: "projete" },
      temCobranca: true,
    });
  });

  it("status cancelada não é ativa, e price id desconhecido vira preco null", async () => {
    from.mockReturnValueOnce(
      consulta({
        data: {
          stripe_customer_id: "cus_1",
          status: "canceled",
          current_period_end: null,
          cancel_at_period_end: false,
          price_id: "price_que_nao_existe",
        },
      }),
    );
    const r = (await status({ context })) as { ativa: boolean; preco: unknown };
    expect(r.ativa).toBe(false);
    expect(r.preco).toBeNull();
  });

  // PAY-21: o par legado saiu do código; mesmo com o secret antigo ainda
  // definido, o price id dele não vira preço.
  it("ignora o price id legado de antes de 26/jul", async () => {
    process.env.STRIPE_PRICE_ID_MENSAL = "price_legado_mensal";
    try {
      from.mockReturnValueOnce(
        consulta({
          data: { stripe_customer_id: "cus_1", status: "active", price_id: "price_legado_mensal" },
        }),
      );
      const r = (await status({ context })) as { preco: unknown };
      expect(r.preco).toBeNull();
    } finally {
      delete process.env.STRIPE_PRICE_ID_MENSAL;
    }
  });
});

describe("abrirPortalCobranca", () => {
  it("sem customer na Stripe não abre portal (quem nunca pagou não tem o que ver)", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    expect(await portal({ context })).toEqual({
      url: null,
      error: "A Pólia One não encontrou uma cobrança sua pra gerenciar.",
    });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("cria a sessão pro customer dela com retorno em /configuracoes", async () => {
    from.mockReturnValueOnce(consulta({ data: { stripe_customer_id: "cus_1" } }));
    stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing/x" });
    expect(await portal({ context })).toEqual({ url: "https://billing/x", error: null });
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://one.usepolia.com.br/configuracoes",
      locale: "pt-BR",
    });
  });

  it("sessão sem URL vira erro genérico", async () => {
    from.mockReturnValueOnce(consulta({ data: { stripe_customer_id: "cus_1" } }));
    stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: null });
    expect(await portal({ context })).toEqual({
      url: null,
      error: "A Pólia One não conseguiu abrir a página de pagamento agora. Tenta de novo.",
    });
  });

  it("exceção dispara portal_cobranca_erro e devolve a mesma mensagem", async () => {
    from.mockReturnValueOnce(consulta({ data: { stripe_customer_id: "cus_1" } }));
    stripeMock.billingPortal.sessions.create.mockRejectedValue(new Error("No configuration"));
    expect(await portal({ context })).toEqual({
      url: null,
      error: "A Pólia One não conseguiu abrir a página de pagamento agora. Tenta de novo.",
    });
    expect(dispararAlerta).toHaveBeenCalledWith(
      "portal_cobranca_erro",
      expect.any(String),
      expect.objectContaining({ mensagem: "No configuration" }),
    );
  });
});

describe("cancelarAssinatura", () => {
  it("bloqueia sem assinatura ativa", async () => {
    from.mockReturnValueOnce(
      consulta({ data: { stripe_subscription_id: "sub_1", status: "canceled" } }),
    );
    expect(await cancelar({ context })).toEqual({
      ok: false,
      error: "Você não tem uma assinatura ativa pra cancelar.",
    });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("cancela no fim do período (não corta o acesso já pago) e espelha no banco", async () => {
    from.mockReturnValueOnce(
      consulta({ data: { stripe_subscription_id: "sub_1", status: "active" } }),
    );
    const update = consulta({ error: null });
    from.mockReturnValueOnce(update);
    stripeMock.subscriptions.update.mockResolvedValue({ cancel_at_period_end: true });

    expect(await cancelar({ context })).toEqual({ ok: true, error: null });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
    });
    expect(update.update).toHaveBeenCalledWith({ cancel_at_period_end: true });
    expect(update.eq).toHaveBeenCalledWith("user_id", "u-1");
  });

  it("falha ao espelhar no banco não desfaz o cancelamento na Stripe", async () => {
    from.mockReturnValueOnce(
      consulta({ data: { stripe_subscription_id: "sub_1", status: "active" } }),
    );
    from.mockReturnValueOnce(consulta({ error: { message: "db" } }));
    stripeMock.subscriptions.update.mockResolvedValue({ cancel_at_period_end: true });
    expect(await cancelar({ context })).toEqual({ ok: true, error: null });
  });

  it("exceção da Stripe devolve ok false", async () => {
    from.mockReturnValueOnce(
      consulta({ data: { stripe_subscription_id: "sub_1", status: "active" } }),
    );
    stripeMock.subscriptions.update.mockRejectedValue(new Error("x"));
    expect(await cancelar({ context })).toEqual({
      ok: false,
      error: "A Pólia One não conseguiu cancelar sua assinatura agora. Tenta de novo.",
    });
  });
});
