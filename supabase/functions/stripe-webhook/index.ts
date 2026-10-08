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

async function upsertAssinaturaDaSubscription(
  subscription: Stripe.Subscription,
  stripeEventId: string,
) {
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
    const customer = await stripe.customers.retrieve(customerId);
    userId = !customer.deleted ? (customer.metadata?.user_id as string | undefined) : undefined;
    if (!userId) {
      console.error("[stripe-webhook] Sem user_id para vincular a assinatura", subscription.id);
      return;
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
        void dispararAlerta(
          "stripe_assinatura_duplicada",
          "Usuária com duas assinaturas pagando ao mesmo tempo",
          { userId, vigente: linhaAtual.stripe_subscription_id, nova: subscription.id },
        );
      }
      return;
    }
    const { error: insertError } = await supabaseAdmin
      .from("assinaturas")
      .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (insertError) throw insertError;
  }

  if (STATUS_COM_ACESSO.includes(subscription.status)) {
    if (priceId && PRICE_TO_PLANO[priceId]) {
      await supabaseAdmin
        .from("profiles")
        .update({ plano: PRICE_TO_PLANO[priceId] })
        .eq("id", userId);
    }
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
    `Agora falta criar sua senha para entrar na Pólia One pela primeira vez.\n\n${linkAtivacao}\n\nEsse link expira em algumas horas. Se não foi você quem comprou, ignore este e-mail.`,
    emailPolia({
      preheader: "Agora falta criar sua senha para entrar na Pólia One.",
      headline: "Sua compra foi confirmada",
      paragrafos: [
        "Agora falta criar sua senha para entrar na Pólia One pela primeira vez.",
        "Esse link expira em algumas horas. Se não foi você quem comprou, ignore este e-mail.",
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
    `O plano já está ativo na sua conta da Pólia One. É só entrar com este e-mail (${email}).\n\n${SITE_URL}/auth/login\n\nSe não lembra a senha, use "Esqueci minha senha" na tela de entrada. Se não foi você quem comprou, responda a este e-mail.`,
    emailPolia({
      preheader: "O plano já está ativo na sua conta da Pólia One.",
      headline: "Sua compra foi confirmada",
      paragrafos: [
        "O plano já está ativo na sua conta da Pólia One. É só entrar com este e-mail.",
        'Se não lembra a senha, use "Esqueci minha senha" na tela de entrada.',
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

async function enviarEmailCancelamento(email: string, dataFimAcesso: string | null) {
  const paragrafo1 = dataFimAcesso
    ? `Seu acesso à Pólia One continua até ${dataFimAcesso}.`
    : "Seu acesso à Pólia One continua até o fim do período já pago.";
  return await enviarViaResend(
    "Sua assinatura foi cancelada",
    `${paragrafo1}\n\nSe quiser voltar depois, seus dados continuam guardados.\n\n${SITE_URL}/planos\n\nAlguma dúvida? Fale com a Pólia: ${SITE_URL}/ajuda`,
    emailPolia({
      preheader: paragrafo1,
      headline: "Assinatura cancelada",
      paragrafos: [paragrafo1, "Se quiser voltar depois, seus dados continuam guardados."],
      ctaLabel: "Assinar de novo",
      ctaUrl: `${SITE_URL}/planos`,
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
    ? `Em ${dataCobranca} vamos cobrar ${valorFormatado} no cartão cadastrado pra continuar seu acesso à Pólia One.`
    : `Em poucos dias vamos cobrar ${valorFormatado} no cartão cadastrado pra continuar seu acesso à Pólia One.`;
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
// também resolve (entrar + "Esqueci minha senha").
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
async function resolverContaDaCompra(
  email: string,
  customerId: string,
  origem: Record<string, string>,
  sessionId: string,
): Promise<ContaDaCompra | null> {
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
      // Sem isso, uma falha aqui é uma venda perdida em silêncio: o Stripe já
      // cobrou (o evento não trata isso como erro pro Stripe, pra não reentregar
      // e cobrar de novo), mas ninguém fica sabendo que a conta nunca foi
      // criada.
      void dispararAlerta(
        "stripe_webhook_falha_criar_conta",
        "Compra paga, mas a conta não foi criada",
        {
          email,
          customerId,
          mensagem: error?.message ?? "generateLink não devolveu usuário",
        },
      );
      return null;
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
      // (entrar + "Esqueci minha senha"), e o alerta avisa que o link falhou.
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

  // E-mail da compra (checkout.session.completed), enviado só no fim do
  // caminho de sucesso, depois do registro do event.id.
  let emailDaCompra: { para: string; pendente: EmailDaCompra } | null = null;

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

        const conta = await resolverContaDaCompra(
          email,
          customerId,
          origemDaSessao(session.metadata),
          session.id,
        );
        if (!conta) {
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
        await upsertAssinaturaDaSubscription(subscription, event.id);
        await registrarEventoAnalytics("checkout_concluido", session.id, {
          plano: session.metadata?.plano ?? null,
          ...origemDaSessao(session.metadata),
        });
        // QA-38: o e-mail sai só depois do registro do evento (fim do handler).
        // Antes saía dentro de resolverContaDaCompra, antes do upsert: se o
        // upsert falhava, o Stripe reentregava e ela recebia ativação + "conta
        // existente".
        emailDaCompra = { para: email, pendente: conta.emailPendente };
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertAssinaturaDaSubscription(event.data.object as Stripe.Subscription, event.id);
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
  // manda: melhor um e-mail a mais que nenhum.
  if (emailDaCompra && registroErro?.code !== "23505") {
    await enviarEmailDaCompra(emailDaCompra.para, emailDaCompra.pendente);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
