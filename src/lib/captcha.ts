// Anti-robô nas telas de conta (FUN-03). O Turnstile roda na tela e o token vai
// junto pro Supabase Auth (options.captchaToken). Quem confere é o próprio
// Supabase, com a chave secreta em Authentication > Attack Protection.
//
// Enquanto o captcha estiver desligado lá, o token é ignorado e nada muda. Por
// isso a tela não bloqueia o envio sem token: com bloqueador de anúncio o widget
// não carrega, e o login seguiria funcionando até a proteção ser ligada. Ligada,
// o Supabase recusa e a mensagem abaixo explica o que fazer.

export const MSG_CAPTCHA =
  "Confirma que não é um robô e tenta de novo. Se a verificação não aparecer, desativa o bloqueador de anúncios e recarrega a página.";

export function ehErroDeCaptcha(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  return error.code === "captcha_failed" || /captcha/i.test(error.message ?? "");
}

/** Token pro options.captchaToken: undefined quando o widget não deu token. */
export function tokenCaptcha(token: string | null): string | undefined {
  return token ?? undefined;
}
