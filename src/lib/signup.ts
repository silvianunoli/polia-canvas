// Com "Confirm email" ligado, o Supabase Auth não devolve erro quando o e-mail
// já tem conta (proteção contra enumeração): responde 200, não manda e-mail
// nenhum e devolve um user falso com identities vazio. Sem esta checagem o
// /auth/cadastro mandava pra "confira seu e-mail" e nada chegava (ONE-79).
// O formato com error.message cobre o caso em que a proteção estiver desligada.
type RespostaSignup = {
  user: { identities?: unknown[] | null } | null;
};

export function emailJaTemConta(
  data: RespostaSignup | null | undefined,
  error: { message: string } | null | undefined,
): boolean {
  if (error) return /already/i.test(error.message) || /registered/i.test(error.message);
  return !!data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
}

// ── Entrada na conta (login) ────────────────────────────────────────────────
// O motivo decide a mensagem e se conta tentativa pro bloqueio de 60s. Só
// "credenciais" conta: queda de rede e limite do servidor não são senha
// errada, e contar isso travava quem estava sem internet.
export type MotivoErroLogin =
  | "captcha"
  | "rede"
  | "limite"
  | "email_nao_confirmado"
  | "credenciais";

type ErroDoAuth = {
  code?: string | null;
  message?: string | null;
  name?: string | null;
  status?: number | null;
};

/** Falha de transporte: sem internet ou servidor fora (supabase-js chama de AuthRetryableFetchError). */
export function ehErroDeRede(error: ErroDoAuth | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  if (error.status === 0) return true;
  if (typeof error.status === "number" && error.status >= 500) return true;
  return /failed to fetch|network ?error|load failed|fetch failed/i.test(error.message ?? "");
}

export function classificarErroLogin(error: ErroDoAuth): MotivoErroLogin {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (code === "captcha_failed" || /captcha/i.test(msg)) return "captcha";
  if (ehErroDeRede(error)) return "rede";
  if (error.status === 429 || code.startsWith("over_") || /rate limit/i.test(msg)) return "limite";
  if (code === "email_not_confirmed" || /confirm/i.test(msg) || /verified/i.test(msg)) {
    return "email_nao_confirmado";
  }
  return "credenciais";
}

export const MSG_LOGIN_REDE =
  "A Pólia One não conseguiu falar com o servidor. Confere a internet e tenta de novo.";
export const MSG_LOGIN_LIMITE = "Muitas tentativas seguidas. Espera um minuto e tenta de novo.";

/**
 * A sessão aberta é da pessoa desta tela? Compara o e-mail sem caixa e sem
 * espaço. Sem um dos dois, responde não: na dúvida, a tela não navega com a
 * sessão de outra pessoa (A logada, B se cadastrando no mesmo navegador).
 */
export function sessaoEhDoEmail(
  emailDaSessao: string | null | undefined,
  emailDaTela: string | null | undefined,
): boolean {
  const a = emailDaSessao?.trim().toLowerCase();
  const b = emailDaTela?.trim().toLowerCase();
  return !!a && !!b && a === b;
}
