import Stripe from "npm:stripe@22.3.0";
import { createClient } from "npm:@supabase/supabase-js@2";

// Stripe manda o corpo assinado (sem JWT de usuária) — esta função fica com
// verify_jwt = false e valida a autenticidade pela assinatura HMAC do próprio
// Stripe (STRIPE_WEBHOOK_SECRET), não por token do Supabase Auth.

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SITE_URL = "https://usepolia.com.br";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Client separado, apontando pro schema auth: é a forma direta de checar se um
// e-mail já tem conta sem paginar admin.listUsers(). Service role já ignora RLS.
const supabaseAuthSchema = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "auth" },
});

const PRICE_TO_PLANO: Record<string, string> = {};
const PRICE_MENSAL = Deno.env.get("STRIPE_PRICE_ID_MENSAL");
const PRICE_ANUAL = Deno.env.get("STRIPE_PRICE_ID_ANUAL");
if (PRICE_MENSAL) PRICE_TO_PLANO[PRICE_MENSAL] = "mensal";
if (PRICE_ANUAL) PRICE_TO_PLANO[PRICE_ANUAL] = "anual";

async function upsertAssinaturaDaSubscription(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const patch = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    price_id: priceId,
    status: subscription.status,
    current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  // A linha já existe desde que a usuária iniciou a assinatura (server function
  // iniciarAssinatura). Atualiza por stripe_subscription_id — não por user_id —
  // porque o webhook não sabe o user_id direto.
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("assinaturas")
    .update(patch)
    .eq("stripe_subscription_id", subscription.id)
    .select("user_id");
  if (updateError) throw updateError;

  let userId = updated?.[0]?.user_id as string | undefined;

  if (!userId) {
    // Fallback: webhook chegou antes do upsert inicial (ou a linha nunca foi
    // criada). Busca o user_id nos metadados do Customer (gravados na criação).
    const customer = await stripe.customers.retrieve(customerId);
    userId = !customer.deleted ? (customer.metadata?.user_id as string | undefined) : undefined;
    if (!userId) {
      console.error("[stripe-webhook] Sem user_id para vincular a assinatura", subscription.id);
      return;
    }
    const { error: insertError } = await supabaseAdmin
      .from("assinaturas")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (insertError) throw insertError;
  }

  if (priceId && PRICE_TO_PLANO[priceId]) {
    await supabaseAdmin.from("profiles").update({ plano: PRICE_TO_PLANO[priceId] }).eq("id", userId);
  }
}

async function buscarUserIdPorEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAuthSchema
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (error) {
    console.error("[stripe-webhook] Erro ao buscar usuária por e-mail:", error);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

// Mirror de src/lib/email-template.ts — Deno Edge Function é runtime separado
// do Worker, não dá pra importar de src/lib direto. Manter os dois em sync.
function emailPolia(opts: { preheader: string; headline: string; paragrafos: string[]; ctaLabel: string; ctaUrl: string }): string {
  const corpo = opts.paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2C2C2C;">${p}</p>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${opts.headline}</title></head>
  <body style="margin:0;padding:0;background-color:#F2F0ED;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F0ED;">
      <tr><td align="center" style="padding:40px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr><td style="padding-bottom:24px;text-align:left;">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#0A0A0A;">Pólia</span>
          </td></tr>
          <tr><td style="background-color:#ffffff;border:1px solid #E6E6E6;border-radius:12px;padding:32px;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#0A0A0A;">${opts.headline}</h1>
            ${corpo}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
              <tr><td style="border-radius:8px;background-color:#7CCBCD;">
                <a href="${opts.ctaUrl}" style="display:inline-block;padding:14px 32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#0A0A0A;text-decoration:none;border-radius:8px;">${opts.ctaLabel}</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding-top:24px;text-align:left;">
            <p style="margin:0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#9E9E9E;">Pólia · usepolia.com.br</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function enviarEmailAtivacao(email: string, linkAtivacao: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[stripe-webhook] Missing RESEND_API_KEY — e-mail de ativação não enviado.");
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: [email],
        subject: "Sua compra foi confirmada — crie sua senha",
        text: `Sua compra na Pólia foi confirmada.\n\nCria sua senha e entra pela primeira vez:\n${linkAtivacao}\n\nEsse link expira em algumas horas. Se não foi você quem comprou, ignora este e-mail.`,
        html: emailPolia({
          preheader: "Sua compra foi confirmada — crie sua senha.",
          headline: "Sua compra foi confirmada",
          paragrafos: [
            "Cria sua senha e entra pela primeira vez na Pólia.",
            "Esse link expira em algumas horas. Se não foi você quem comprou, ignora este e-mail.",
          ],
          ctaLabel: "Criar minha senha",
          ctaUrl: linkAtivacao,
        }),
      }),
    });
    if (!resp.ok) {
      console.error("[stripe-webhook] Falha ao enviar e-mail de ativação:", await resp.text());
    }
  } catch (err) {
    console.error("[stripe-webhook] Erro ao enviar e-mail de ativação:", err);
  }
}

// Resolve o e-mail de quem comprou pra um user_id: reaproveita conta existente
// (ex.: já tinha convite) ou cria uma nova + manda o link de ativação. Em
// qualquer um dos casos, grava o user_id nos metadados do Customer no Stripe —
// upsertAssinaturaDaSubscription já sabe ler esse metadado como fallback.
async function resolverContaDaCompra(email: string, customerId: string): Promise<string | null> {
  const existente = await buscarUserIdPorEmail(email);
  let userId = existente;

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${SITE_URL}/onboarding` },
    });
    if (error || !data.user) {
      console.error("[stripe-webhook] Falha ao criar conta pra compra:", error);
      return null;
    }
    userId = data.user.id;
    await enviarEmailAtivacao(email, data.properties.action_link);
  }

  try {
    await stripe.customers.update(customerId, { metadata: { user_id: userId } });
  } catch (err) {
    console.error("[stripe-webhook] Falha ao gravar user_id no Customer:", err);
  }

  return userId;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  if (!signature || !webhookSecret) {
    return new Response("Configuração de webhook ausente.", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error("[stripe-webhook] Assinatura inválida:", err);
    return new Response("Assinatura inválida.", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        if (!email || !customerId || !subscriptionId) {
          console.error("[stripe-webhook] checkout.session.completed sem e-mail/customer/subscription.");
          break;
        }

        const userId = await resolverContaDaCompra(email, customerId);
        if (!userId) break;

        // A assinatura em si (status, ciclo, plano) é gravada pelo mesmo
        // caminho de customer.subscription.created/updated — busca a
        // subscription e reaproveita o upsert já existente, agora que o
        // Customer já tem o user_id certo nos metadados.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertAssinaturaDaSubscription(subscription);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertAssinaturaDaSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const { data } = await supabaseAdmin
          .from("assinaturas")
          .update({ status: "canceled", cancel_at_period_end: false })
          .eq("stripe_subscription_id", subscription.id)
          .select("user_id");
        const userId = data?.[0]?.user_id as string | undefined;
        if (userId) {
          await supabaseAdmin.from("profiles").update({ plano: "cancelada" }).eq("id", userId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef =
          invoice.parent?.type === "subscription_details" ? invoice.parent.subscription_details?.subscription : null;
        const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subscriptionId) {
          await supabaseAdmin
            .from("assinaturas")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId)
            .neq("status", "canceled");
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Erro ao processar ${event.type}:`, err);
    return new Response("Erro ao processar evento.", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
