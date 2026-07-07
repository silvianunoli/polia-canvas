import Stripe from "stripe";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

let _stripe: Stripe | undefined;

function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("[Stripe] Missing STRIPE_SECRET_KEY environment variable.");
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }
  _stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  return _stripe;
}

function precoParaPlano(plano: "mensal" | "anual"): string {
  const priceId =
    plano === "mensal" ? process.env.STRIPE_PRICE_ID_MENSAL : process.env.STRIPE_PRICE_ID_ANUAL;
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
}

async function lerAssinatura(userId: string): Promise<AssinaturaRow | null> {
  const { data } = await supabaseAdmin
    .from("assinaturas" as never)
    .select("stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as unknown as AssinaturaRow) ?? null;
}

const STATUS_ATIVOS = new Set(["active", "past_due", "trialing"]);

const iniciarAssinaturaInput = z.object({ plano: z.enum(["mensal", "anual"]) });

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
      return { clientSecret: null, error: "Não consegui iniciar sua assinatura agora. Tenta de novo." };
    }
  });

export const statusAssinatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const assinatura = await lerAssinatura(context.userId);
    if (!assinatura) return { ativa: false, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    return {
      ativa: STATUS_ATIVOS.has(assinatura.status),
      status: assinatura.status,
      currentPeriodEnd: assinatura.current_period_end,
      cancelAtPeriodEnd: assinatura.cancel_at_period_end,
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
