// Regras puras do stripe-webhook (HIG-18, 08/10/2026). Sem import de runtime
// (nada de Deno, npm: ou URL): roda no Deno da edge function e no Vitest do
// app (src/lib/stripeWebhookRegras.test.ts). Antes as 10 functions não tinham
// teste nenhum porque o Vitest não resolve os imports delas. Tudo que DECIDE
// (quem tem acesso, quando rebaixar, se o cancelamento é desta vez) mora aqui;
// o index.ts só fala com o Stripe e com o banco.

export const STATUS_ATIVOS_FOUNDER = ["active", "trialing"];

// Status em que a assinatura já foi paga ao menos uma vez e dá acesso.
// "incomplete" (janela de pagamento aberta e não paga) fica de fora: antes de
// 05/10/2026 o plano era gravado só pelo price id, então abrir o pagamento em
// /assinar e fechar sem pagar liberava o Premium (QA-01).
export const STATUS_COM_ACESSO = ["active", "trialing", "past_due"];

export interface CancelamentoCampos {
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | null;
}

// Cancelamento marcado pro fim do período. O cancelarAssinatura do app usa
// cancel_at_period_end; o portal do Stripe pode marcar por cancel_at. Os dois
// contam.
export function cancelamentoAgendado(s: CancelamentoCampos): boolean {
  return s.cancel_at_period_end === true || (s.cancel_at ?? null) !== null;
}

// Este evento é a VIRADA pra "cancelamento agendado"? Remonta o estado de antes
// com previous_attributes (o Stripe só manda ali o que mudou). Sem esses
// campos em previous_attributes, este evento não mexeu no cancelamento.
export function cancelamentoFoiAgendadoNesteEvento(
  payload: CancelamentoCampos,
  anteriores: CancelamentoCampos | undefined,
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

/**
 * O que fazer com o plano a partir do status atual da assinatura:
 * - "liberar": pagou (ou está em trial/carência), grava o plano do preço;
 * - "cancelada": pagou um dia e parou (unpaid, ou incomplete_expired depois de
 *   ter tido acesso), vira "cancelada";
 * - "nada": nunca pagou (incomplete, incomplete_expired sem acesso antes). O
 *   plano que ela tem não veio desta assinatura: não mexe, senão derruba o
 *   Premium/Pro liberado à mão de quem abriu o checkout e desistiu (PAY-30).
 */
export function acaoDoPlano(
  status: string,
  statusAnterior: string | null,
): "liberar" | "cancelada" | "nada" {
  if (STATUS_COM_ACESSO.includes(status)) return "liberar";
  if (status === "unpaid") return "cancelada";
  if (
    status === "incomplete_expired" &&
    statusAnterior !== null &&
    STATUS_COM_ACESSO.includes(statusAnterior)
  ) {
    return "cancelada";
  }
  return "nada";
}

/**
 * customer.subscription.deleted só tira o plano (e manda o e-mail de
 * "terminou") quando as duas coisas valem: o perfil está num plano pago E a
 * assinatura teve fatura paga. Só o plano não bastava: conta com Premium/Pro
 * liberado à mão que abandonava o checkout virava "cancelada" (PAY-30).
 */
export function cancelamentoEncerraAcesso(
  planoDoPerfil: string | null | undefined,
  assinaturaFoiPaga: boolean,
): boolean {
  return (planoDoPerfil === "controle" || planoDoPerfil === "projete") && assinaturaFoiPaga;
}

// Origem de campanha (landing + UTMs) que o checkout público grava nos
// metadados da sessão. Cópia da allowlist de src/lib/origemCampanha.ts: esta
// função roda em Deno e não importa o código do app. Só as chaves conhecidas,
// e o valor fora do padrão é descartado.
const CHAVES_ORIGEM = [
  "origem",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
const VALOR_ORIGEM_VALIDO = /^[\p{L}\p{N} ._\-/|+]{1,100}$/u;

export function origemDaSessao(
  metadata: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const saida: Record<string, string> = {};
  if (!metadata) return saida;
  for (const chave of CHAVES_ORIGEM) {
    const v = metadata[chave]?.trim();
    if (v && VALOR_ORIGEM_VALIDO.test(v)) saida[chave] = v;
  }
  return saida;
}

// "ana.souza@gmail.com" -> "an***@gmail.com". O alerta vai pro Telegram: dá
// pra achar a compra no Stripe pelo começo do e-mail sem expor o endereço.
export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!dominio) return "***";
  return `${local.slice(0, 2)}***@${dominio}`;
}

// E-mail de quem comprou sempre minúsculo e sem espaço (08/10/2026): o hook de
// cadastro procura o convite por lower(trim(email)) com igualdade exata, então
// "Ana@..." gravado cru em convites_cadastro bloqueava a conta da compra paga.
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Mensagem de erro do Resend pode repetir o endereço: troca qualquer e-mail
// por [email] antes de mandar pro alerta.
export function semEmails(texto: string): string {
  return texto.replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, "[email]").slice(0, 200);
}

// Data dos e-mails no fuso de Brasília. Sem timeZone, o Deno formata em UTC e
// uma assinatura que vence às 22h do dia 9 aparecia como "10/10".
export function formatarDataBR(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
