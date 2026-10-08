import Stripe from "stripe";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispararAlerta } from "@/lib/alertas.server";
import { HOST_CANONICO as SITE_URL } from "@/lib/seo";

let _stripe: Stripe | undefined;

export function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("[Stripe] Missing STRIPE_SECRET_KEY environment variable.");
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }
  _stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  return _stripe;
}

export type PlanoAssinatura =
  | "controle_mensal"
  | "controle_anual"
  | "projete_mensal"
  | "projete_anual";

const ENV_PRICE_POR_PLANO: Record<PlanoAssinatura, string | undefined> = {
  controle_mensal: process.env.STRIPE_PRICE_ID_CONTROLE_MENSAL,
  controle_anual: process.env.STRIPE_PRICE_ID_CONTROLE_ANUAL,
  projete_mensal: process.env.STRIPE_PRICE_ID_PROJETE_MENSAL,
  projete_anual: process.env.STRIPE_PRICE_ID_PROJETE_ANUAL,
};

export function precoParaPlano(plano: PlanoAssinatura): string {
  const priceId = ENV_PRICE_POR_PLANO[plano];
  if (!priceId) {
    console.error(`[Stripe] Missing STRIPE_PRICE_ID_${plano.toUpperCase()} environment variable.`);
    throw new Error(`Missing price id for plano "${plano}".`);
  }
  return priceId;
}

interface AssinaturaRow {
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_id: string | null;
}

async function lerAssinatura(userId: string): Promise<AssinaturaRow | null> {
  const { data } = await supabaseAdmin
    .from("assinaturas" as never)
    .select(
      "stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, price_id",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as unknown as AssinaturaRow) ?? null;
}

interface InfoPreco {
  valorCentavos: number;
  intervalo: "month" | "year";
  tier: "controle" | "projete";
}

// Sem chamada extra ao Stripe: os valores são os mesmos que a gente cadastrou
// (ver criarPlanosStripe), então mapeia direto do price id conhecido por env.
function infoDoPreco(priceId: string | null): InfoPreco | null {
  const mapa: Record<string, InfoPreco> = {};
  const add = (id: string | undefined, info: InfoPreco) => {
    if (id) mapa[id] = info;
  };
  add(process.env.STRIPE_PRICE_ID_CONTROLE_MENSAL, {
    valorCentavos: 2990,
    intervalo: "month",
    tier: "controle",
  });
  add(process.env.STRIPE_PRICE_ID_CONTROLE_ANUAL, {
    valorCentavos: 29900,
    intervalo: "year",
    tier: "controle",
  });
  add(process.env.STRIPE_PRICE_ID_PROJETE_MENSAL, {
    valorCentavos: 4790,
    intervalo: "month",
    tier: "projete",
  });
  add(process.env.STRIPE_PRICE_ID_PROJETE_ANUAL, {
    valorCentavos: 47900,
    intervalo: "year",
    tier: "projete",
  });
  return priceId ? (mapa[priceId] ?? null) : null;
}

const STATUS_ATIVOS = new Set(["active", "past_due", "trialing"]);

const iniciarAssinaturaInput = z.object({
  plano: z.enum(["controle_mensal", "controle_anual", "projete_mensal", "projete_anual"]),
});

export const iniciarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => iniciarAssinaturaInput.parse(input))
  .handler(async ({ data, context }) => {
    const existente = await lerAssinatura(context.userId);
    if (existente && STATUS_ATIVOS.has(existente.status)) {
      return { clientSecret: null, error: "Você já tem uma assinatura ativa." };
    }

    const stripe = stripeClient();
    const priceId = precoParaPlano(data.plano);

    // Tentativa anterior abandonada (janela de pagamento fechada sem pagar):
    // cancela antes de abrir outra, senão cada clique deixa uma assinatura
    // incompleta solta no Stripe. O webhook ignora o cancelamento de quem
    // nunca pagou (sem e-mail, sem mexer no plano).
    if (existente?.status === "incomplete" && existente.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(existente.stripe_subscription_id);
      } catch (err) {
        console.error("[Stripe] Falha ao cancelar tentativa anterior incompleta:", err);
      }
    }

    try {
      const customerId =
        existente?.stripe_customer_id ??
        (
          await stripe.customers.create({
            email: typeof context.claims.email === "string" ? context.claims.email : undefined,
            metadata: { user_id: context.userId },
          })
        ).id;

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice"],
      });

      const { error: upsertError } = await supabaseAdmin.from("assinaturas" as never).upsert(
        {
          user_id: context.userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          price_id: priceId,
          status: subscription.status,
          current_period_end: new Date(
            subscription.items.data[0].current_period_end * 1000,
          ).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        } as never,
        { onConflict: "user_id" },
      );
      if (upsertError) {
        console.error("[Stripe] Falha ao salvar assinatura local:", upsertError);
        return {
          clientSecret: null,
          error: "A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.",
        };
      }

      const invoice = subscription.latest_invoice;
      const clientSecret =
        invoice && typeof invoice !== "string"
          ? (invoice.confirmation_secret?.client_secret ?? null)
          : null;

      if (!clientSecret) {
        return {
          clientSecret: null,
          error: "A Pólia One não conseguiu preparar o pagamento agora. Tenta de novo.",
        };
      }
      return { clientSecret, error: null };
    } catch (err) {
      console.error("[Stripe] Erro ao criar assinatura:", err);
      void dispararAlerta("checkout_erro", "Erro ao criar assinatura (checkout)", {
        mensagem: err instanceof Error ? err.message : String(err),
      });
      return {
        clientSecret: null,
        error: "A Pólia One não conseguiu iniciar sua assinatura agora. Tenta de novo.",
      };
    }
  });

export const statusAssinatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const assinatura = await lerAssinatura(context.userId);
    if (!assinatura) {
      return {
        ativa: false,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        preco: null,
        temCobranca: false,
      };
    }
    return {
      ativa: STATUS_ATIVOS.has(assinatura.status),
      status: assinatura.status,
      currentPeriodEnd: assinatura.current_period_end,
      cancelAtPeriodEnd: assinatura.cancel_at_period_end,
      preco: infoDoPreco(assinatura.price_id),
      // Existe customer na Stripe: já passou por cobrança alguma vez, então o
      // Portal de cobrança tem o que mostrar (cartão, faturas, dados). Quem
      // nunca pagou (Grátis, beta) não tem customer e não vê o botão.
      temCobranca: !!assinatura.stripe_customer_id,
    };
  });

// Portal de cobrança hospedado pela Stripe: trocar cartão, ver faturas e
// atualizar dados de cobrança. A gente não constrói nenhuma tela de cartão —
// a sessão é curta e a URL só vale pro customer dela.
//
// PRÉ-REQUISITO DE CONTA (não é código): a Stripe exige uma Portal
// Configuration ativa em Settings > Billing > Customer portal. Sem isso a API
// responde "No configuration provided and your test mode default
// configuration has not been created" e a usuária só vê o erro genérico.
export const abrirPortalCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const assinatura = await lerAssinatura(context.userId);
    if (!assinatura?.stripe_customer_id) {
      return { url: null, error: "Não encontramos uma cobrança sua pra gerenciar." };
    }

    try {
      const stripe = stripeClient();
      const session = await stripe.billingPortal.sessions.create({
        customer: assinatura.stripe_customer_id,
        return_url: `${SITE_URL}/configuracoes`,
        locale: "pt-BR",
      });
      if (!session.url) {
        console.error("[Stripe] Sessão do portal criada sem URL.");
        return {
          url: null,
          error: "A Pólia One não conseguiu abrir a página de pagamento agora. Tenta de novo.",
        };
      }
      return { url: session.url, error: null };
    } catch (err) {
      console.error("[Stripe] Erro ao abrir portal de cobrança:", err);
      void dispararAlerta("portal_cobranca_erro", "Erro ao abrir o portal de cobrança", {
        mensagem: err instanceof Error ? err.message : String(err),
      });
      return {
        url: null,
        error: "A Pólia One não conseguiu abrir a página de pagamento agora. Tenta de novo.",
      };
    }
  });

// QA-06 (08/10/2026): quem já é Premium e clica em "Assinar o Pro" caía no
// /assinar, que só serve pra quem está no Grátis, e era mandada pro Painel.
// Trocar de plano numa assinatura que já existe é no portal do Stripe, que
// cobra só a diferença (configuração conferida no PAY-20). Abre o portal já
// na tela de troca de plano; se esse atalho falhar, abre o portal comum.
export const abrirTrocaDePlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const assinatura = await lerAssinatura(context.userId);
    if (
      !assinatura?.stripe_customer_id ||
      !assinatura.stripe_subscription_id ||
      !STATUS_ATIVOS.has(assinatura.status)
    ) {
      return {
        url: null,
        error: "A Pólia One não encontrou uma assinatura ativa pra trocar de plano.",
      };
    }
    const stripe = stripeClient();
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: assinatura.stripe_customer_id,
        return_url: `${SITE_URL}/painel`,
        locale: "pt-BR",
        flow_data: {
          type: "subscription_update",
          subscription_update: { subscription: assinatura.stripe_subscription_id },
          after_completion: {
            type: "redirect",
            redirect: { return_url: `${SITE_URL}/painel` },
          },
        },
      });
      if (session.url) return { url: session.url, error: null };
    } catch (err) {
      console.error("[Stripe] Atalho de troca de plano falhou, abrindo portal comum:", err);
      void dispararAlerta("portal_troca_plano_erro", "Atalho de troca de plano do portal falhou", {
        mensagem: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: assinatura.stripe_customer_id,
        return_url: `${SITE_URL}/painel`,
        locale: "pt-BR",
      });
      if (session.url) return { url: session.url, error: null };
    } catch (err) {
      console.error("[Stripe] Erro ao abrir portal pra troca de plano:", err);
    }
    return {
      url: null,
      error: "A Pólia One não conseguiu abrir a troca de plano agora. Tenta de novo.",
    };
  });

export const cancelarAssinatura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const assinatura = await lerAssinatura(context.userId);
    if (!assinatura?.stripe_subscription_id || !STATUS_ATIVOS.has(assinatura.status)) {
      return { ok: false, error: "Você não tem uma assinatura ativa pra cancelar." };
    }

    try {
      const stripe = stripeClient();
      const subscription = await stripe.subscriptions.update(assinatura.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      const { error: updateError } = await supabaseAdmin
        .from("assinaturas" as never)
        .update({ cancel_at_period_end: subscription.cancel_at_period_end } as never)
        .eq("user_id", context.userId);
      if (updateError) {
        console.error("[Stripe] Falha ao salvar cancelamento local:", updateError);
      }
      return { ok: true, error: null };
    } catch (err) {
      console.error("[Stripe] Erro ao cancelar assinatura:", err);
      return {
        ok: false,
        error: "A Pólia One não conseguiu cancelar sua assinatura agora. Tenta de novo.",
      };
    }
  });
