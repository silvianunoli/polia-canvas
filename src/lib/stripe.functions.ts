import Stripe from "stripe";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispararAlerta } from "@/lib/alertas.server";

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

export type PlanoAssinatura = "controle_mensal" | "controle_anual" | "projete_mensal" | "projete_anual";

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
  // Legado: price ids de antes de 26/jul, quando só existia um plano pago.
  add(process.env.STRIPE_PRICE_ID_MENSAL, { valorCentavos: 2900, intervalo: "month", tier: "controle" });
  add(process.env.STRIPE_PRICE_ID_ANUAL, { valorCentavos: 29000, intervalo: "year", tier: "controle" });
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
          current_period_end: new Date(subscription.items.data[0].current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        } as never,
        { onConflict: "user_id" },
      );
      if (upsertError) {
        console.error("[Stripe] Falha ao salvar assinatura local:", upsertError);
        return { clientSecret: null, error: "Não consegui iniciar sua assinatura agora. Tenta de novo." };
      }

      const invoice = subscription.latest_invoice;
      const clientSecret =
        invoice && typeof invoice !== "string" ? (invoice.confirmation_secret?.client_secret ?? null) : null;

      if (!clientSecret) {
        return { clientSecret: null, error: "Não consegui preparar o pagamento agora. Tenta de novo." };
      }
      return { clientSecret, error: null };
    } catch (err) {
      console.error("[Stripe] Erro ao criar assinatura:", err);
      void dispararAlerta("checkout_erro", "Erro ao criar assinatura (checkout)", {
        mensagem: err instanceof Error ? err.message : String(err),
      });
      return { clientSecret: null, error: "Não consegui iniciar sua assinatura agora. Tenta de novo." };
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
      };
    }
    return {
      ativa: STATUS_ATIVOS.has(assinatura.status),
      status: assinatura.status,
      currentPeriodEnd: assinatura.current_period_end,
      cancelAtPeriodEnd: assinatura.cancel_at_period_end,
      preco: infoDoPreco(assinatura.price_id),
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
      return { ok: false, error: "Não consegui cancelar sua assinatura agora. Tenta de novo." };
    }
  });
