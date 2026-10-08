// Fila de reenvio dos e-mails do Stripe (PAY-27, 08/10/2026). Puro, sem import
// de runtime: roda no Deno (stripe-webhook e reenviar-emails) e no Vitest
// (src/lib/reenvioEmail.test.ts).
//
// Antes, e-mail que o Resend recusava (fora do ar, cota, chave errada) só
// disparava o alerta stripe_webhook_email_falhou: a cliente que pagou podia
// ficar sem o link de criar senha. Agora o envio que falha entra na tabela
// emails_pendentes e a função reenviar-emails tenta de novo com estes
// intervalos, contados a partir de cada falha.

/** Espera antes da tentativa seguinte, por número de falhas já acumuladas. */
export const ESPERAS_MINUTOS = [5, 15, 45, 120, 360, 720];

/** Depois de tantas falhas, desiste e avisa (o alerta pede resolver à mão). */
export const MAX_TENTATIVAS = ESPERAS_MINUTOS.length;

/**
 * Quando tentar de novo, dado quantas vezes já falhou (contando a falha que
 * acabou de acontecer). null = desistir.
 */
export function proximaTentativaEm(falhas: number, agora: Date): Date | null {
  if (!Number.isInteger(falhas) || falhas < 1 || falhas > MAX_TENTATIVAS) return null;
  return new Date(agora.getTime() + ESPERAS_MINUTOS[falhas - 1] * 60_000);
}
