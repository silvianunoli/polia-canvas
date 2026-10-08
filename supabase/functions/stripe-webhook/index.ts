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
const SITE_URL = "https://one.usepolia.com.br";
// Link de alerta interno (Telegram, ver dispararAlerta abaixo): vai direto pro
// domínio do admin, não pro produto. office.usepolia.com.br é o admin de
// verdade desde 01/09/2026 (polia-admin/wrangler.jsonc); não tem relação com
// SITE_URL nem com o antigo prefixo /admin, que não existe mais em lugar nenhum.
const ADMIN_URL = "https://office.usepolia.com.br";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PRICE_TO_PLANO: Record<string, string> = {};
// O par legado (STRIPE_PRICE_ID_MENSAL/ANUAL, da conta Stripe antiga) saiu em
// 07/10/2026 (PAY-21): nenhuma assinatura usava, e a conta nova só tem os 4 abaixo.

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
      body: JSON.stringify({ tipo, titulo, detalhes, link: `${ADMIN_URL}/qualidade` }),
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

// Origem de campanha (landing + UTMs) que o checkout público grava nos
// metadados da sessão. Cópia da allowlist de src/lib/origemCampanha.ts: esta
// função roda em Deno e não importa o código do app. Só as chaves conhecidas,
// e o valor fora do padrão é descartado. Nada aqui interfere na compra: sem
// origem válida, o evento só sai sem ela.
const CHAVES_ORIGEM = [
  "origem",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
const VALOR_ORIGEM_VALIDO = /^[\p{L}\p{N} ._\-/|+]{1,100}$/u;

function origemDaSessao(metadata: Stripe.Metadata | null | undefined): Record<string, string> {
  const saida: Record<string, string> = {};
  if (!metadata) return saida;
  for (const chave of CHAVES_ORIGEM) {
    const v = metadata[chave]?.trim();
    if (v && VALOR_ORIGEM_VALIDO.test(v)) saida[chave] = v;
  }
  return saida;
}

// Eventos de assinatura pro Founder Dashboard (founder_eventos, origem webhook).
// sessao_id é derivado do id do evento Stripe (uuid v5-like): determinístico,
// então a reentrega do mesmo evento não gera sessão nova.
async function sessaoDoEventoStripe(stripeEventId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(stripeEventId));
  const h = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

async function registrarFounderEvento(
  evento: "subscription_started" | "subscription_cancelled" | "payment_failed",
  userId: string,
  stripeEventId: string,
  propriedades: Record<string, unknown> = {},
) {
  try {
    await supabaseAdmin.from("founder_eventos").insert({
      user_id: userId,
      sessao_id: await sessaoDoEventoStripe(stripeEventId),
      evento,
      feature: "assinatura",
      pagina: "server:stripe-webhook",
      ambiente: "prod",
      origem: "webhook",
      propriedades,
    });
  } catch (err) {
    console.error("[stripe-webhook] Falha ao gravar founder_eventos:", err);
  }
}

async function registrarFalhaWebhook(tipoEvento: string, mensagem: string) {
  try {
    await supabaseAdmin.from("founder_eventos_sistema").insert({
      tipo: "webhook_failure",
      origem: "stripe-webhook",
      servico: "stripe",
      detalhes: { evento: tipoEvento, mensagem: mensagem.slice(0, 300) },
    });
  } catch (err) {
    console.error("[stripe-webhook] Falha ao gravar founder_eventos_sistema:", err);
  }
}

const STATUS_ATIVOS_FOUNDER = ["active", "trialing"];

// Status em que a assinatura já foi paga ao menos uma vez e dá acesso.
// "incomplete" (janela de pagamento aberta e não paga) fica de fora: antes de
// 05/10/2026 o plano era gravado só pelo price id, então abrir o pagamento em
// /assinar e fechar sem pagar liberava o Premium (QA-01).
const STATUS_COM_ACESSO = ["active", "trialing", "past_due"];

// Cancelamento marcado pro fim do período. O cancelarAssinatura do app usa
// cancel_at_period_end; o portal do Stripe pode marcar por cancel_at. Os dois
// contam.
function cancelamentoAgendado(
  s: Pick<Stripe.Subscription, "cancel_at_period_end" | "cancel_at">,
): boolean {
  return s.cancel_at_period_end === true || (s.cancel_at ?? null) !== null;
}

// Este evento é a VIRADA pra "cancelamento agendado"? Remonta o estado de antes
// com previous_attributes (o Stripe só manda ali o que mudou). Sem esses
// campos em previous_attributes, este evento não mexeu no cancelamento.
function cancelamentoFoiAgendadoNesteEvento(
  payload: Stripe.Subscription,
  anteriores: Partial<Stripe.Subscription> | undefined,
): boolean {
  if (!anteriores) return false;
  const mudouPeriodo = "cancel_at_period_end" in anteriores;
  const mudouData = "cancel_at" in anteriores;
  if (!mudouPeriodo && !mudouData) return false;
  const antes = {
    cancel_at_period_end: mudouPeriodo
      ? (anteriores.cancel_at_period_end ?? false)
      : payload.cancel_at_period_end,
    cancel_at: mudouData ? (anteriores.cancel_at ?? null) : payload.cancel_at,
  };
  return !cancelamentoAgendado(antes) && cancelamentoAgendado(payload);
}

// Até quando o acesso vai, já formatado no fuso de Brasília.
function fimDoAcesso(s: Stripe.Subscription): string | null {
  const fim = s.cancel_at ?? s.items.data[0]?.current_period_end ?? null;
  return fim ? formatarDataBR(new Date(fim * 1000)) : null;
}

// Quem nunca pagou (incomplete_expired) volta pro Grátis; quem pagou e parou
// de pagar (unpaid) fica como cancelada, igual ao customer.subscription.deleted.
// Só mexe em plano pago: beta e contas liberadas à mão ficam como estão.
async function rebaixarPlanoSemPagamento(
  userId: string,
  status: string,
  statusAnterior: string | null,
) {
  const jaTeveAcesso =
    status === "unpaid" || (statusAnterior !== null && STATUS_COM_ACESSO.includes(statusAnterior));
  await supabaseAdmin
    .from("profiles")
    .update({ plano: jaTeveAcesso ? "cancelada" : "confere" })
    .eq("id", userId)
    .in("plano", ["controle", "projete"]);
}

const msgErro = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200);

// Estorna o que foi pago na última fatura da assinatura duplicada. Seguro pra
// reentrega e pra eventos simultâneos da mesma assinatura: pula pagamento que
// já tem estorno e usa chave de idempotência por pagamento. Devolve um resumo
// pro alerta. Pode jogar: quem chama trata.
async function estornarUltimaFatura(subscription: Stripe.Subscription): Promise<string> {
  const invoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  if (!invoiceId) return "sem fatura pra estornar";

  // Nas versões novas da API a Invoice não traz mais payment_intent/charge
  // direto: o pagamento mora em invoicePayments.
  const pagamentos = await stripe.invoicePayments.list({
    invoice: invoiceId,
    status: "paid",
    limit: 10,
  });
  const feitos: string[] = [];
  for (const pagamento of pagamentos.data) {
    const pi = pagamento.payment.payment_intent;
    const ch = pagamento.payment.charge;
    const paymentIntent = typeof pi === "string" ? pi : pi?.id;
    const charge = typeof ch === "string" ? ch : ch?.id;
    if (!paymentIntent && !charge) continue;
    const alvo = paymentIntent ? { payment_intent: paymentIntent } : { charge: charge! };

    const existentes = await stripe.refunds.list({ ...alvo, limit: 10 });
    if (existentes.data.some((r) => r.status !== "failed" && r.status !== "canceled")) {
      feitos.push(`já estava estornado (${paymentIntent ?? charge})`);
      continue;
    }
    const estorno = await stripe.refunds.create(
      {
        ...alvo,
        reason: "duplicate",
        metadata: { motivo: "compra_duplicada", assinatura: subscription.id },
      },
      { idempotencyKey: `polia-estorno-duplicada-${paymentIntent ?? charge}` },
    );
    feitos.push(`${estorno.id} (${estorno.status}, ${estorno.amount / 100} ${estorno.currency})`);
  }
  return feitos.length > 0 ? feitos.join("; ") : "nada pago nessa fatura ainda";
}

// Compra duplicada (08/10/2026): a mesma pessoa ficou com duas assinaturas com
// acesso (ex.: comprou de novo na /planos antes do webhook da 1ª chegar). Antes
// só ia um alerta e a 2ª seguia cobrando todo mês. Agora a que NÃO está
// gravada como vigente é cancelada na hora e a fatura paga dela é estornada.
// Nunca joga: falha em qualquer parte vira alerta pra resolver à mão, e o
// resto do evento segue.
async function desfazerAssinaturaDuplicada(
  subscription: Stripe.Subscription,
  userId: string,
  vigente: string,
): Promise<void> {
  let cancelada = "não tentado";
  let estorno = "não tentado";
  let deuCerto = true;
  try {
    await stripe.subscriptions.cancel(subscription.id);
    cancelada = "sim";
  } catch (err) {
    deuCerto = false;
    cancelada = `falhou: ${msgErro(err)}`;
    console.error("[stripe-webhook] Falha ao cancelar assinatura duplicada:", subscription.id, err);
  }
  try {
    estorno = await estornarUltimaFatura(subscription);
  } catch (err) {
    deuCerto = false;
    estorno = `falhou: ${msgErro(err)}`;
    console.error("[stripe-webhook] Falha ao estornar assinatura duplicada:", subscription.id, err);
  }
  await dispararAlerta(
    "stripe_assinatura_duplicada",
    deuCerto
      ? "Compra duplicada desfeita: a assinatura nova foi cancelada e estornada"
      : "Compra duplicada: parte do desfazer falhou, conferir no Stripe",
    { userId, vigente, duplicada: subscription.id, cancelada, estorno },
  );
}

interface ResultadoUpsert {
  userId: string | null;
  // Esta assinatura era uma compra duplicada e foi desfeita: quem chama não
  // manda e-mail de compra confirmada nem de cancelamento por ela.
  duplicada: boolean;
}

async function upsertAssinaturaDaSubscription(
  subscription: Stripe.Subscription,
  stripeEventId: string,
  // Quem chama já sabe a dona (checkout.session.completed). Sem isso, se o
  // customers.update do user_id falhava, a compra paga ficava sem plano.
  userIdConhecido?: string,
): Promise<ResultadoUpsert> {
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // Status anterior, pra saber se esta atualização é o começo da assinatura.
  const { data: antes } = await supabaseAdmin
    .from("assinaturas")
    .select("status")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  const statusAnterior = (antes as { status?: string } | null)?.status ?? null;

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
    userId = userIdConhecido;
    if (!userId) {
      const customer = await stripe.customers.retrieve(customerId);
      userId = !customer.deleted ? (customer.metadata?.user_id as string | undefined) : undefined;
    }
    if (!userId) {
      console.error("[stripe-webhook] Sem user_id para vincular a assinatura", subscription.id);
      return { userId: null, duplicada: false };
    }
    // A linha é uma por usuária. Se ela já aponta pra OUTRA assinatura com
    // acesso, este evento é de uma assinatura velha (tentativa abandonada que
    // expirou) ou de uma compra duplicada: não pode sobrescrever a que está
    // pagando nem mexer no plano.
    const { data: atual } = await supabaseAdmin
      .from("assinaturas")
      .select("stripe_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();
    const linhaAtual = atual as { stripe_subscription_id: string | null; status: string } | null;
    if (
      linhaAtual?.stripe_subscription_id &&
      linhaAtual.stripe_subscription_id !== subscription.id &&
      STATUS_COM_ACESSO.includes(linhaAtual.status)
    ) {
      console.error(
        "[stripe-webhook] Evento de assinatura que não é a vigente da usuária, ignorado:",
        subscription.id,
        subscription.status,
      );
      if (STATUS_COM_ACESSO.includes(subscription.status)) {
        // Duas com acesso ao mesmo tempo: desfaz a que não é a vigente
        // (cancela + estorna). Ver desfazerAssinaturaDuplicada.
        await desfazerAssinaturaDuplicada(subscription, userId, linhaAtual.stripe_subscription_id);
        return { userId, duplicada: true };
      }
      return { userId, duplicada: false };
    }
    const { error: insertError } = await supabaseAdmin
      .from("assinaturas")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (insertError) throw insertError;
  }

  if (STATUS_COM_ACESSO.includes(subscription.status)) {
    const planoDoPreco = priceId ? PRICE_TO_PLANO[priceId] : undefined;
    if (!planoDoPreco) {
      // Preço fora do mapa (secret STRIPE_PRICE_ID_* faltando ou preço novo
      // criado no Stripe): a assinatura cobra e o plano não muda. Antes isso
      // passava calado. Agora alerta e devolve 500: o Stripe reentrega, e
      // quando o secret for corrigido a reentrega grava o plano.
      await dispararAlerta(
        "stripe_webhook_preco_desconhecido",
        "Assinatura paga com preço que o webhook não conhece: plano não liberado",
        { userId, assinatura: subscription.id, priceId },
      );
      throw new Error(`Preço sem plano no webhook: ${priceId ?? "(sem price)"}`);
    }
    const { error: erroPlano } = await supabaseAdmin
      .from("profiles")
      .update({ plano: planoDoPreco })
      .eq("id", userId);
    // Sem plano gravado ela pagou e segue no Grátis: erro aqui também reentrega.
    if (erroPlano) throw erroPlano;
  } else if (subscription.status === "incomplete_expired" || subscription.status === "unpaid") {
    await rebaixarPlanoSemPagamento(userId, subscription.status, statusAnterior);
  }

  if (
    STATUS_ATIVOS_FOUNDER.includes(subscription.status) &&
    !(statusAnterior && STATUS_ATIVOS_FOUNDER.includes(statusAnterior))
  ) {
    await registrarFounderEvento("subscription_started", userId, stripeEventId, {
      status: subscription.status,
      price_id: priceId,
    });
  }
  return { userId, duplicada: false };
}

// Busca via função SQL (migration 20261005140000), não por .from("users") no
// schema auth: a API não garante expor esse schema, e uma busca que falha em
// silêncio faz quem JÁ tem conta parecer nova. O generateLink de convite então
// falha com "já cadastrado" e a compra paga fica sem conta ligada (primeira
// compra real, 05/10/2026). Erro aqui NÃO pode virar "não achei": joga, o
// webhook devolve 500 e o Stripe reentrega.
async function buscarUserIdPorEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("buscar_user_id_por_email", {
    p_email: email,
  });
  if (error) {
    console.error("[stripe-webhook] Erro ao buscar usuária por e-mail:", error);
    throw new Error(`Falha ao buscar usuária por e-mail: ${error.message}`);
  }
  return (data as string | null) ?? null;
}

// "ana.souza@gmail.com" -> "an***@gmail.com". O alerta vai pro Telegram: dá
// pra achar a compra no Stripe pelo começo do e-mail sem expor o endereço.
function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return "***";
  return `${local.slice(0, 2)}***@${dominio}`;
}

// E-mail de quem comprou sempre minúsculo e sem espaço (08/10/2026): o hook de
// cadastro procura o convite por lower(trim(email)) com igualdade exata, então
// "Ana@..." gravado cru em convites_cadastro bloqueava a conta da compra paga.
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Data dos e-mails no fuso de Brasília. Sem timeZone, o Deno formata em UTC e
// uma assinatura que vence às 22h do dia 9 aparecia como "10/10".
function formatarDataBR(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Mensagem de erro do Resend pode repetir o endereço: troca qualquer e-mail
// por [email] antes de mandar pro alerta.
function semEmails(texto: string): string {
  return texto.replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, "[email]").slice(0, 200);
}

// QA-38: devolve se o e-mail saiu. Antes a falha (inclusive chave ausente) só
// ia pro console.error e ninguém ficava sabendo que a cliente não recebeu o
// e-mail. Agora toda falha dispara o alerta stripe_webhook_email_falhou.
// Não reenvia sozinha: a fila de reenvio é o próximo passo.
async function enviarViaResend(
  subject: string,
  text: string,
  html: string,
  to: string,
  contexto: string,
): Promise<boolean> {
  const avisarFalha = (motivo: string, detalhe?: string) =>
    dispararAlerta("stripe_webhook_email_falhou", `E-mail do Stripe não saiu: ${contexto}`, {
      email: mascararEmail(to),
      qual: contexto,
      motivo,
      ...(detalhe ? { detalhe: semEmails(detalhe) } : {}),
    });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error(`[stripe-webhook] Missing RESEND_API_KEY — ${contexto} não enviado.`);
    await avisarFalha("RESEND_API_KEY ausente");
    return false;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        // Quem responde um e-mail de cobrança chega na caixa real da Pólia,
        // não no naoresponda@ (08/10/2026).
        reply_to: "oi@usepolia.com.br",
        to: [to],
        subject,
        text,
        html,
      }),
    });
    if (!resp.ok) {
      const corpo = await resp.text();
      console.error(`[stripe-webhook] Falha ao enviar ${contexto}:`, corpo);
      await avisarFalha(`Resend devolveu HTTP ${resp.status}`, corpo);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[stripe-webhook] Erro ao enviar ${contexto}:`, err);
    await avisarFalha("erro de rede", err instanceof Error ? err.message : String(err));
    return false;
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
  return await enviarViaResend(
    "Sua compra foi confirmada",
    `Agora falta criar sua senha para entrar na Pólia One pela primeira vez.\n\n${linkAtivacao}\n\nEsse link vale por pouco tempo. Se não foi você quem comprou, ignore este e-mail.`,
    emailPolia({
      preheader: "Agora falta criar sua senha para entrar na Pólia One.",
      headline: "Sua compra foi confirmada",
      paragrafos: [
        "Agora falta criar sua senha para entrar na Pólia One pela primeira vez.",
        "Esse link vale por pouco tempo. Se não foi você quem comprou, ignore este e-mail.",
      ],
      ctaLabel: "Criar minha senha",
      ctaUrl: linkAtivacao,
    }),
    email,
    "e-mail de ativação",
  );
}

// Quem comprou já tinha conta: não há senha pra criar, então o e-mail só
// confirma a compra e leva pro login. Sem ele, a pessoa pagava e a tela de
// "compra confirmada" prometia um link que nunca chegava.
async function enviarEmailCompraContaExistente(email: string) {
  return await enviarViaResend(
    "Sua compra foi confirmada",
    `O plano já está ativo na sua conta da Pólia One. É só entrar com este e-mail (${email}).\n\n${SITE_URL}/auth/login\n\nSe não lembra a senha, use "Recuperar acesso" na tela de entrada. Se não foi você quem comprou, escreva pra oi@usepolia.com.br.`,
    emailPolia({
      preheader: "O plano já está ativo na sua conta da Pólia One.",
      headline: "Sua compra foi confirmada",
      paragrafos: [
        "O plano já está ativo na sua conta da Pólia One. É só entrar com este e-mail.",
        'Se não lembra a senha, use "Recuperar acesso" na tela de entrada.',
        "Se não foi você quem comprou, escreva pra oi@usepolia.com.br.",
      ],
      ctaLabel: "Entrar na Pólia",
      ctaUrl: `${SITE_URL}/auth/login`,
    }),
    email,
    "e-mail de compra em conta existente",
  );
}

async function enviarEmailPagamentoRecusado(email: string) {
  return await enviarViaResend(
    "Pagamento recusado",
    `Atualize a forma de pagamento pra manter seu acesso sem interrupção:\n${SITE_URL}/configuracoes\n\nA cobrança da sua assinatura na Pólia One não funcionou.\n\nAlguma dúvida? Fale com a Pólia: ${SITE_URL}/ajuda`,
    emailPolia({
      preheader: "A cobrança da sua assinatura não funcionou.",
      headline: "Pagamento recusado",
      paragrafos: ["Atualize a forma de pagamento pra manter seu acesso sem interrupção."],
      alerta: "A cobrança da sua assinatura na Pólia One não funcionou.",
      ctaLabel: "Atualizar pagamento",
      ctaUrl: `${SITE_URL}/configuracoes`,
    }),
    email,
    "e-mail de pagamento recusado",
  );
}

// Sai quando ela PEDE o cancelamento (customer.subscription.updated com
// cancel_at_period_end virando true), não no fim do período: antes só saía no
// customer.subscription.deleted, no último dia, dizendo "continua até [hoje]"
// (08/10/2026). O fim do período manda enviarEmailAssinaturaTerminou.
async function enviarEmailCancelamentoAgendado(email: string, dataFimAcesso: string | null) {
  const paragrafo1 = dataFimAcesso
    ? `O cancelamento está confirmado. O acesso à Pólia One continua até ${dataFimAcesso}.`
    : "O cancelamento está confirmado. O acesso à Pólia One continua até o fim do período já pago.";
  const paragrafo2 = "Até lá, nada muda. Depois, a conta volta pro plano Grátis e os dados continuam guardados.";
  return await enviarViaResend(
    "Cancelamento confirmado",
    `${paragrafo1}\n\n${paragrafo2}\n\n${SITE_URL}/configuracoes\n\nAlguma dúvida? Fale com a Pólia: ${SITE_URL}/ajuda`,
    emailPolia({
      preheader: paragrafo1,
      headline: "Cancelamento confirmado",
      paragrafos: [paragrafo1, paragrafo2],
      ctaLabel: "Ver minha assinatura",
      ctaUrl: `${SITE_URL}/configuracoes`,
    }),
    email,
    "e-mail de cancelamento confirmado",
  );
}

// Texto curto do fim de verdade (customer.subscription.deleted). O aviso com a
// data já saiu quando ela pediu o cancelamento; este só fecha o ciclo.
async function enviarEmailAssinaturaTerminou(email: string) {
  const paragrafo1 =
    "A assinatura da Pólia One terminou, e a conta voltou pro plano Grátis.";
  const paragrafo2 = "O Planejamento e os dados continuam guardados, caso queira voltar.";
  return await enviarViaResend(
    "Sua assinatura terminou",
    `${paragrafo1}\n\n${paragrafo2}\n\n${SITE_URL}/planos\n\nAlguma dúvida? Fale com a Pólia: ${SITE_URL}/ajuda`,
    emailPolia({
      preheader: paragrafo1,
      headline: "Assinatura encerrada",
      paragrafos: [paragrafo1, paragrafo2],
      ctaLabel: "Assinar de novo",
      ctaUrl: `${SITE_URL}/planos`,
    }),
    email,
    "e-mail de assinatura encerrada",
  );
}

async function enviarEmailRenovacao(
  email: string,
  valorFormatado: string,
  dataCobranca: string | null,
) {
  const paragrafo = dataCobranca
    ? `Em ${dataCobranca} a Pólia cobra ${valorFormatado} no cartão cadastrado pra manter o acesso à Pólia One.`
    : `Em poucos dias a Pólia cobra ${valorFormatado} no cartão cadastrado pra manter o acesso à Pólia One.`;
  return await enviarViaResend(
    "Sua assinatura renova em breve",
    `${paragrafo}\n\n${SITE_URL}/configuracoes\n\nAlguma dúvida? Fale com a Pólia: ${SITE_URL}/ajuda`,
    emailPolia({
      preheader: paragrafo,
      headline: "Renovação chegando",
      paragrafos: [paragrafo],
      ctaLabel: "Ver minha assinatura",
      ctaUrl: `${SITE_URL}/configuracoes`,
    }),
    email,
    "e-mail de renovação",
  );
}

// Chave do user_metadata com o id da checkout session que criou a conta.
// Serve pra reconhecer, na reentrega do mesmo checkout.session.completed, que
// a conta "existente" é a que esta mesma compra criou (QA-38).
const META_COMPRA_SESSION_ID = "compra_session_id";

// Qual e-mail a compra manda, decidido em resolverContaDaCompra e enviado só
// no fim do caminho de sucesso (QA-38):
//  - ativacao: conta criada agora, com o link do convite;
//  - reenviar_ativacao: conta criada por esta mesma sessão numa entrega
//    anterior que falhou depois de criar a conta; ela ainda não criou senha.
//    O link novo só é gerado na hora de enviar (gerar link invalida o anterior);
//  - conta_existente: já tinha conta antes da compra.
type EmailDaCompra =
  | { tipo: "ativacao"; link: string }
  | { tipo: "reenviar_ativacao" }
  | { tipo: "conta_existente" };

interface ContaDaCompra {
  userId: string;
  emailPendente: EmailDaCompra;
}

// A conta já existente foi criada por esta mesma checkout session e ainda
// não criou senha? Falha de leitura vira "não": o e-mail de conta existente
// também resolve (entrar + "Recuperar acesso").
async function contaCriadaPorEstaSessao(userId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    console.error("[stripe-webhook] Erro ao ler a conta na reentrega da compra:", error);
    return false;
  }
  const meta = data.user.user_metadata ?? {};
  return meta[META_COMPRA_SESSION_ID] === sessionId && meta.precisa_criar_senha === true;
}

// Resolve o e-mail de quem comprou pra um user_id: reaproveita conta existente
// (ex.: já tinha convite) ou cria uma nova. NÃO manda e-mail: devolve qual
// e-mail mandar, e quem chama envia só depois do upsert da assinatura e do
// registro do evento (QA-38). Em qualquer caso, grava o user_id nos metadados
// do Customer no Stripe — upsertAssinaturaDaSubscription já sabe ler esse
// metadado como fallback.
//
// `email` chega já normalizado (normalizarEmail). Se a conta não puder ser
// criada, JOGA (08/10/2026): o handler devolve 500 sem gravar o event.id e o
// Stripe reentrega. Antes devolvia null, o evento era gravado como processado
// e a compra paga ficava sem conta pra sempre.
async function resolverContaDaCompra(
  email: string,
  customerId: string,
  origem: Record<string, string>,
  sessionId: string,
): Promise<ContaDaCompra> {
  const existente = await buscarUserIdPorEmail(email);
  let userId = existente;
  let emailPendente: EmailDaCompra;

  if (!userId) {
    // PAY-02 (achado 14/08, confirmado ao vivo em 15/09 via "Invite user" no
    // Dashboard): o Auth Hook "Before User Created" (hook_checar_convite_cadastro)
    // bloqueia QUALQUER criação de conta sem linha correspondente em
    // convites_cadastro com usado_em null — inclusive esta, criada pelo admin
    // API, não só o signup público. Sem isso, todo mundo que comprar sem
    // convite prévio (o caminho inteiro da compra pública) cai bloqueado.
    // Quem pagou já "ganhou" o convite: insere a linha antes de gerar o link
    // (23505 = e-mail já tinha convite de outra origem, ignora e segue —
    // o gatilho que marca usado_em roda de qualquer jeito na criação da conta).
    const { error: erroConvite } = await supabaseAdmin.from("convites_cadastro").insert({ email });
    if (erroConvite && erroConvite.code !== "23505") {
      console.error("[stripe-webhook] Falha ao liberar convite implícito da compra:", erroConvite);
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      // O convite só faz login: precisa_criar_senha (mesmo nome de
      // META_PRECISA_CRIAR_SENHA em src/lib/senha.ts) faz a área logada pedir
      // nome e senha antes de qualquer outra tela (QA-03).
      // origem_campanha (FUN-07): mesmo campo que o cadastro Grátis grava,
      // pra conta nascida da compra também dizer de qual landing veio.
      options: {
        redirectTo: `${SITE_URL}/auth/criar-senha`,
        data: {
          precisa_criar_senha: true,
          [META_COMPRA_SESSION_ID]: sessionId,
          ...(Object.keys(origem).length > 0 ? { origem_campanha: origem } : {}),
        },
      },
    });
    if (error || !data.user) {
      console.error("[stripe-webhook] Falha ao criar conta pra compra:", error);
      // O Stripe já cobrou e a conta não nasceu. Reentregar NÃO cobra de novo
      // (o webhook só lê a cobrança, quem cobra é o checkout): a reentrega só
      // tenta criar a conta outra vez. E é segura: buscarUserIdPorEmail acha a
      // conta se ela chegou a ser criada, e contaCriadaPorEstaSessao reconhece
      // que foi esta compra que criou. Por isso joga em vez de devolver null:
      // o handler responde 500, não grava o event.id, e o Stripe tenta de novo
      // (até ~3 dias). O alerta avisa já na primeira falha.
      await dispararAlerta(
        "stripe_webhook_falha_criar_conta",
        "Compra paga, mas a conta não foi criada (o Stripe vai reentregar)",
        {
          email: mascararEmail(email),
          customerId,
          mensagem: semEmails(error?.message ?? "generateLink não devolveu usuário"),
        },
      );
      // A mensagem vai pro alerta genérico do catch: sem e-mail nela.
      throw new Error(
        `Falha ao criar conta pra compra: ${semEmails(error?.message ?? "generateLink sem usuário")}`,
      );
    }
    userId = data.user.id;
    emailPendente = { tipo: "ativacao", link: data.properties.action_link };
  } else if (await contaCriadaPorEstaSessao(userId, sessionId)) {
    emailPendente = { tipo: "reenviar_ativacao" };
  } else {
    emailPendente = { tipo: "conta_existente" };
  }

  try {
    await stripe.customers.update(customerId, { metadata: { user_id: userId } });
  } catch (err) {
    console.error("[stripe-webhook] Falha ao gravar user_id no Customer:", err);
  }

  return { userId, emailPendente };
}

// Link novo pra conta criada numa entrega anterior desta compra. O convite
// ("invite") não serve pra conta que já existe; o magiclink faz o mesmo login
// e /auth/criar-senha só precisa da sessão (precisa_criar_senha já está na
// conta desde a primeira entrega).
async function gerarLinkDeAtivacaoDeNovo(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE_URL}/auth/criar-senha` },
  });
  if (error || !data?.properties?.action_link) {
    console.error("[stripe-webhook] Falha ao gerar link de ativação de novo:", error);
    return null;
  }
  return data.properties.action_link;
}

// Envia o e-mail decidido em resolverContaDaCompra. Nunca joga: roda depois
// do registro do evento, e um erro aqui não pode virar 500 (o Stripe
// reentregaria um evento já registrado à toa).
async function enviarEmailDaCompra(email: string, pendente: EmailDaCompra): Promise<void> {
  try {
    if (pendente.tipo === "ativacao") {
      await enviarEmailAtivacao(email, pendente.link);
      return;
    }
    if (pendente.tipo === "reenviar_ativacao") {
      const link = await gerarLinkDeAtivacaoDeNovo(email);
      if (link) {
        await enviarEmailAtivacao(email, link);
        return;
      }
      // Sem link novo, o e-mail de conta existente ainda leva ao acesso
      // (entrar + "Recuperar acesso"), e o alerta avisa que o link falhou.
      await dispararAlerta(
        "stripe_webhook_email_falhou",
        "E-mail do Stripe não saiu: link de ativação na reentrega da compra",
        {
          email: mascararEmail(email),
          qual: "e-mail de ativação (reentrega)",
          motivo: "generateLink magiclink falhou; mandado o e-mail de conta existente no lugar",
        },
      );
    }
    await enviarEmailCompraContaExistente(email);
  } catch (err) {
    console.error("[stripe-webhook] Erro ao enviar e-mail da compra:", err);
    await dispararAlerta("stripe_webhook_email_falhou", "E-mail do Stripe não saiu: compra", {
      email: mascararEmail(email),
      qual: pendente.tipo,
      motivo: err instanceof Error ? err.message : String(err),
    });
  }
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

  // E-mails que só saem no fim do caminho de sucesso, depois do registro do
  // event.id (compra, cancelamento confirmado, assinatura encerrada). Se algo
  // no meio falhar (500), nada sai, e a reentrega manda uma vez só.
  const posRegistro: Array<() => Promise<void>> = [];

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Normalizado antes de tudo: busca de conta, convite, criação e e-mail
        // usam o mesmo endereço que o hook de cadastro compara.
        const emailBruto = session.customer_details?.email;
        const email = emailBruto ? normalizarEmail(emailBruto) : null;
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

        // Falha ao criar a conta JOGA (vai pro catch: 500, event.id não é
        // gravado, o Stripe reentrega). Antes devolvia null e o evento era
        // dado como processado com a compra paga sem conta (08/10/2026).
        const conta = await resolverContaDaCompra(
          email,
          customerId,
          origemDaSessao(session.metadata),
          session.id,
        );

        // A assinatura em si (status, ciclo, plano) é gravada pelo mesmo
        // caminho de customer.subscription.created/updated — busca a
        // subscription e reaproveita o upsert já existente. O user_id vai
        // junto: não depende do customers.update ter dado certo.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const resultado = await upsertAssinaturaDaSubscription(
          subscription,
          event.id,
          conta.userId,
        );
        await registrarEventoAnalytics("checkout_concluido", session.id, {
          plano: session.metadata?.plano ?? null,
          ...origemDaSessao(session.metadata),
          ...(resultado.duplicada ? { duplicada_estornada: true } : {}),
        });
        // Compra duplicada desfeita (cancelada + estornada): não manda
        // "Sua compra foi confirmada" por ela. O alerta já foi pra Sil.
        if (resultado.duplicada) break;
        // QA-38: o e-mail sai só depois do registro do evento (fim do handler).
        // Antes saía dentro de resolverContaDaCompra, antes do upsert: se o
        // upsert falhava, o Stripe reentregava e ela recebia ativação + "conta
        // existente".
        const pendente = conta.emailPendente;
        posRegistro.push(() => enviarEmailDaCompra(email, pendente));
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const payload = event.data.object as Stripe.Subscription;
        // Evento fora de ordem (08/10/2026): um "updated" antigo entregue
        // depois do "deleted" regravava status/plano do payload velho e
        // reativava o plano. Grava o estado ATUAL do Stripe; se a leitura
        // falhar, usa o payload como antes.
        let atual = payload;
        try {
          atual = await stripe.subscriptions.retrieve(payload.id);
        } catch (err) {
          console.error("[stripe-webhook] Falha ao ler assinatura atual, usando o payload:", err);
        }
        const resultado = await upsertAssinaturaDaSubscription(atual, event.id);

        // Cancelamento confirmado: e-mail no momento em que ela pede, com a
        // data até quando o acesso vai (08/10/2026). Só quando ESTE evento é a
        // virada (previous_attributes mostra que antes não estava agendado),
        // então reentrega e outros "updated" não repetem. E só se o estado
        // atual continua agendado: cancelou e desistiu logo depois não recebe.
        if (
          event.type === "customer.subscription.updated" &&
          resultado.userId &&
          !resultado.duplicada &&
          STATUS_COM_ACESSO.includes(atual.status) &&
          cancelamentoAgendado(atual) &&
          cancelamentoFoiAgendadoNesteEvento(
            payload,
            (event.data as { previous_attributes?: Partial<Stripe.Subscription> })
              .previous_attributes,
          )
        ) {
          const userId = resultado.userId;
          const dataFim = fimDoAcesso(atual);
          posRegistro.push(async () => {
            const email = await buscarEmailPorUserId(userId);
            if (email) await enviarEmailCancelamentoAgendado(email, dataFim);
          });
        }
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
        // Assinatura que nunca foi paga (tentativa abandonada, cancelada pelo
        // iniciarAssinatura ao tentar de novo) não vira "cancelada" nem manda
        // e-mail de cancelamento: a pessoa nunca teve o plano. Desde a correção
        // do QA-01 o plano pago só é gravado com pagamento confirmado, então é
        // ele que diz se houve acesso (o status da linha pode já ter chegado
        // como "canceled" pelo customer.subscription.updated).
        let tinhaAcesso = false;
        if (userId) {
          const { data: perfil } = await supabaseAdmin
            .from("profiles")
            .select("plano")
            .eq("id", userId)
            .maybeSingle();
          const plano = (perfil as { plano?: string } | null)?.plano ?? "";
          tinhaAcesso = plano === "controle" || plano === "projete";
        }
        if (userId && tinhaAcesso) {
          await supabaseAdmin.from("profiles").update({ plano: "cancelada" }).eq("id", userId);
          await registrarFounderEvento("subscription_cancelled", userId, event.id, {
            current_period_end: currentPeriodEnd ?? null,
          });
          // O aviso com a data saiu quando ela pediu o cancelamento
          // (customer.subscription.updated). Aqui é o fim de verdade: texto
          // curto de "terminou", depois do registro do evento.
          posRegistro.push(async () => {
            const email = await buscarEmailPorUserId(userId);
            if (email) await enviarEmailAssinaturaTerminou(email);
          });
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
        // Primeira cobrança recusada (billing_reason subscription_create) é a
        // pessoa ainda na janela de pagamento, vendo o erro na tela: a
        // assinatura fica "incomplete" no Stripe e pode tentar outro cartão.
        // Marcar past_due aqui contava como ativa e travava a nova tentativa
        // com "Você já tem uma assinatura ativa." (QA-02), além de mandar
        // "Pagamento recusado" pra quem nunca assinou.
        if (subscriptionId && invoice.billing_reason !== "subscription_create") {
          const { data } = await supabaseAdmin
            .from("assinaturas")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId)
            .in("status", ["active", "trialing", "past_due"])
            .select("user_id");
          const userId = data?.[0]?.user_id as string | undefined;
          if (userId) {
            await registrarFounderEvento("payment_failed", userId, event.id, {
              invoice: invoice.id,
            });
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
          ? formatarDataBR(new Date(invoice.next_payment_attempt * 1000))
          : null;
        await enviarEmailRenovacao(email, valorFormatado, dataCobranca);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Erro ao processar ${event.type}:`, err);
    void registrarFalhaWebhook(event.type, err instanceof Error ? err.message : String(err));
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

  // 23505 = outra entrega simultânea do mesmo evento registrou primeiro; ela
  // manda o e-mail. Qualquer outro resultado (inclusive falha do registro)
  // manda: melhor um e-mail a mais que nenhum. Cada envio isolado: um que
  // falha não impede o outro nem vira 500 (o evento já está registrado).
  if (registroErro?.code !== "23505") {
    for (const enviar of posRegistro) {
      try {
        await enviar();
      } catch (err) {
        console.error("[stripe-webhook] Erro ao enviar e-mail pós-registro:", err);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
