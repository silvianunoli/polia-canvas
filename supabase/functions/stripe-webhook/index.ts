import Stripe from "npm:stripe@22.3.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { emailPolia } from "../_shared/email-polia.ts";

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
// Legado: os primeiros price ids (só "Assinatura", sem plano diferenciado)
// mapeiam pra "controle" — era o único plano pago que existia até 26/jul.
const PRICE_LEGADO_MENSAL = Deno.env.get("STRIPE_PRICE_ID_MENSAL");
const PRICE_LEGADO_ANUAL = Deno.env.get("STRIPE_PRICE_ID_ANUAL");
if (PRICE_LEGADO_MENSAL) PRICE_TO_PLANO[PRICE_LEGADO_MENSAL] = "controle";
if (PRICE_LEGADO_ANUAL) PRICE_TO_PLANO[PRICE_LEGADO_ANUAL] = "controle";

const PRICE_CONTROLE_MENSAL = Deno.env.get("STRIPE_PRICE_ID_CONTROLE_MENSAL");
const PRICE_CONTROLE_ANUAL = Deno.env.get("STRIPE_PRICE_ID_CONTROLE_ANUAL");
const PRICE_PROJETE_MENSAL = Deno.env.get("STRIPE_PRICE_ID_PROJETE_MENSAL");
const PRICE_PROJETE_ANUAL = Deno.env.get("STRIPE_PRICE_ID_PROJETE_ANUAL");
if (PRICE_CONTROLE_MENSAL) PRICE_TO_PLANO[PRICE_CONTROLE_MENSAL] = "controle";
if (PRICE_CONTROLE_ANUAL) PRICE_TO_PLANO[PRICE_CONTROLE_ANUAL] = "controle";
if (PRICE_PROJETE_MENSAL) PRICE_TO_PLANO[PRICE_PROJETE_MENSAL] = "projete";
if (PRICE_PROJETE_ANUAL) PRICE_TO_PLANO[PRICE_PROJETE_ANUAL] = "projete";

// Mesmo segredo compartilhado usado pelo Worker Cloudflare — ver
// docs/observabilidade-alertas.md. Fire-and-forget: nunca deixa uma falha de
// alerta atrasar a resposta ao Stripe (que reentrega em não-2xx).
const ALERTAS_SECRET = Deno.env.get("ALERTAS_SECRET") ?? "";
async function dispararAlerta(tipo: string, titulo: string, detalhes?: Record<string, unknown>) {
  if (!ALERTAS_SECRET) {
    console.error("[stripe-webhook] Missing ALERTAS_SECRET — alerta não disparado:", tipo);
    return;
  }
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/alertas-criticos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-alertas-secret": ALERTAS_SECRET },
      body: JSON.stringify({ tipo, titulo, detalhes, link: `${SITE_URL}/admin/qualidade` }),
    });
  } catch (err) {
    console.error("[stripe-webhook] Falha ao chamar alertas-criticos:", err);
  }
}

// track() (src/lib/analytics.ts) é client-only (depende de window/sessionStorage),
// então o webhook grava direto em eventos_analytics pelo mesmo formato — usa o
// id da checkout session como sessao_id pra correlacionar com o
// checkout_iniciado disparado no client (ver src/routes/precos.tsx).
async function registrarEventoAnalytics(
  evento: string,
  stripeSessionId: string,
  propriedades: Record<string, unknown> = {},
) {
  try {
    await supabaseAdmin.from("eventos_analytics").insert({
      evento,
      pagina: "server:stripe-webhook",
      sessao_id: stripeSessionId,
      propriedades,
    });
  } catch (err) {
    console.error("[stripe-webhook] Falha ao gravar evento de analytics:", err);
  }
}

async function upsertAssinaturaDaSubscription(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

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
    await supabaseAdmin
      .from("profiles")
      .update({ plano: PRICE_TO_PLANO[priceId] })
      .eq("id", userId);
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

async function enviarViaResend(
  subject: string,
  text: string,
  html: string,
  to: string,
  contexto: string,
) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error(`[stripe-webhook] Missing RESEND_API_KEY — ${contexto} não enviado.`);
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: [to],
        subject,
        text,
        html,
      }),
    });
    if (!resp.ok) {
      console.error(`[stripe-webhook] Falha ao enviar ${contexto}:`, await resp.text());
    }
  } catch (err) {
    console.error(`[stripe-webhook] Erro ao enviar ${contexto}:`, err);
  }
}

async function buscarEmailPorUserId(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    console.error("[stripe-webhook] Erro ao buscar e-mail por user_id:", error);
    return null;
  }
  return data.user.email ?? null;
}

async function enviarEmailAtivacao(email: string, linkAtivacao: string) {
  await enviarViaResend(
    "Sua compra foi confirmada — crie sua senha",
    `Sua compra na Pólia foi confirmada.\n\nCria sua senha e entra pela primeira vez:\n${linkAtivacao}\n\nEsse link expira em algumas horas. Se não foi você quem comprou, ignora este e-mail.`,
    emailPolia({
      preheader: "Sua compra foi confirmada — crie sua senha.",
      headline: "Sua compra foi confirmada",
      paragrafos: [
        "Cria sua senha e entra pela primeira vez na Pólia.",
        "Esse link expira em algumas horas. Se não foi você quem comprou, ignora este e-mail.",
      ],
      ctaLabel: "Criar minha senha",
      ctaUrl: linkAtivacao,
    }),
    email,
    "e-mail de ativação",
  );
}

async function enviarEmailPagamentoRecusado(email: string) {
  await enviarViaResend(
    "Não conseguimos cobrar seu cartão",
    `A cobrança da sua assinatura na Pólia não passou.\n\nAtualiza a forma de pagamento pra manter o acesso sem interrupção:\n${SITE_URL}/configuracoes`,
    emailPolia({
      preheader: "A cobrança da sua assinatura não passou.",
      headline: "Problema no pagamento",
      paragrafos: [
        "A cobrança da sua assinatura na Pólia não passou. Atualiza a forma de pagamento pra manter o acesso sem interrupção.",
      ],
      ctaLabel: "Atualizar pagamento",
      ctaUrl: `${SITE_URL}/configuracoes`,
    }),
    email,
    "e-mail de pagamento recusado",
  );
}

async function enviarEmailCancelamento(email: string, dataFimAcesso: string | null) {
  const paragrafo1 = dataFimAcesso
    ? `Seu acesso à Pólia continua até ${dataFimAcesso}.`
    : "Seu acesso à Pólia continua até o fim do período já pago.";
  await enviarViaResend(
    "Sua assinatura foi cancelada",
    `${paragrafo1}\n\nMudou de ideia? É só assinar de novo quando quiser — seus dados continuam guardados.\n\n${SITE_URL}/precos`,
    emailPolia({
      preheader: "Sua assinatura na Pólia foi cancelada.",
      headline: "Assinatura cancelada",
      paragrafos: [
        paragrafo1,
        "Mudou de ideia? É só assinar de novo quando quiser — seus dados continuam guardados.",
      ],
      ctaLabel: "Assinar de novo",
      ctaUrl: `${SITE_URL}/precos`,
    }),
    email,
    "e-mail de cancelamento",
  );
}

async function enviarEmailRenovacao(
  email: string,
  valorFormatado: string,
  dataCobranca: string | null,
) {
  const paragrafo = dataCobranca
    ? `Em ${dataCobranca} vamos cobrar ${valorFormatado} no cartão cadastrado pra continuar seu acesso à Pólia.`
    : `Em poucos dias vamos cobrar ${valorFormatado} no cartão cadastrado pra continuar seu acesso à Pólia.`;
  await enviarViaResend(
    "Sua assinatura renova em breve",
    `${paragrafo}\n\n${SITE_URL}/configuracoes`,
    emailPolia({
      preheader: "Sua assinatura na Pólia renova em breve.",
      headline: "Renovação chegando",
      paragrafos: [paragrafo],
      ctaLabel: "Ver minha assinatura",
      ctaUrl: `${SITE_URL}/configuracoes`,
    }),
    email,
    "e-mail de renovação",
  );
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
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("[stripe-webhook] Assinatura inválida:", err);
    void dispararAlerta(
      "stripe_webhook_assinatura_invalida",
      "Assinatura inválida no webhook do Stripe",
      {
        mensagem: err instanceof Error ? err.message : String(err),
      },
    );
    return new Response("Assinatura inválida.", { status: 400 });
  }

  // Idempotência: se já processamos este event.id, devolve 200 sem reprocessar.
  // O Stripe reentrega eventos (retry em não-2xx e, às vezes, duplicatas); sem
  // isso, os e-mails do webhook reenviavam a cada entrega.
  const { data: jaProcessado } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (jaProcessado) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_details?.email;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!email || !customerId || !subscriptionId) {
          console.error(
            "[stripe-webhook] checkout.session.completed sem e-mail/customer/subscription.",
          );
          await registrarEventoAnalytics("checkout_falhou", session.id, {
            motivo: "dados_ausentes",
          });
          break;
        }

        const userId = await resolverContaDaCompra(email, customerId);
        if (!userId) {
          await registrarEventoAnalytics("checkout_falhou", session.id, {
            motivo: "erro_criar_conta",
          });
          break;
        }

        // A assinatura em si (status, ciclo, plano) é gravada pelo mesmo
        // caminho de customer.subscription.created/updated — busca a
        // subscription e reaproveita o upsert já existente, agora que o
        // Customer já tem o user_id certo nos metadados.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertAssinaturaDaSubscription(subscription);
        await registrarEventoAnalytics("checkout_concluido", session.id, {
          plano: session.metadata?.plano ?? null,
        });
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
          .select("user_id, current_period_end");
        const userId = data?.[0]?.user_id as string | undefined;
        const currentPeriodEnd = data?.[0]?.current_period_end as string | undefined;
        if (userId) {
          await supabaseAdmin.from("profiles").update({ plano: "cancelada" }).eq("id", userId);
          const email = await buscarEmailPorUserId(userId);
          if (email) {
            const dataFim = currentPeriodEnd
              ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR")
              : null;
            await enviarEmailCancelamento(email, dataFim);
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef =
          invoice.parent?.type === "subscription_details"
            ? invoice.parent.subscription_details?.subscription
            : null;
        const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subscriptionId) {
          const { data } = await supabaseAdmin
            .from("assinaturas")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId)
            .neq("status", "canceled")
            .select("user_id");
          const userId = data?.[0]?.user_id as string | undefined;
          if (userId) {
            const email = await buscarEmailPorUserId(userId);
            if (email) await enviarEmailPagamentoRecusado(email);
          }
        }
        break;
      }
      case "invoice.upcoming": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const { data } = await supabaseAdmin
          .from("assinaturas")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        const userId = (data as { user_id: string } | null)?.user_id;
        if (!userId) break;
        const email = await buscarEmailPorUserId(userId);
        if (!email) break;
        const valorFormatado = (invoice.amount_due / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        const dataCobranca = invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString("pt-BR")
          : null;
        await enviarEmailRenovacao(email, valorFormatado, dataCobranca);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Erro ao processar ${event.type}:`, err);
    void dispararAlerta(
      "stripe_webhook_erro_processamento",
      "Erro ao processar evento do webhook do Stripe",
      {
        evento: event.type,
        mensagem: err instanceof Error ? err.message : String(err),
      },
    );
    return new Response("Erro ao processar evento.", { status: 500 });
  }

  // Só registra o event.id no fim do caminho de sucesso: se o processamento
  // acima falhar (500), o id NÃO é gravado e a reentrega do Stripe reprocessa.
  const { error: registroErro } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type });
  if (registroErro && registroErro.code !== "23505") {
    console.error("[stripe-webhook] Falha ao registrar event.id:", registroErro);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
