// Links de e-mail pelo nosso domínio (AND-09, plano docs/plano-login-no-app.md).
// O generateLink do Supabase devolve um action_link no servidor de login
// (...supabase.co/auth/v1/verify), e o Android abre esse endereço no Chrome,
// não no app. Este link vai pra https://one.usepolia.com.br/auth/link, que o
// Android abre direto no app (App Links) e que confirma o token_hash pelo
// verifyOtp (src/routes/auth/link.tsx). Puro: sem rede, testável no vitest.

export const SITE_POLIA = "https://one.usepolia.com.br";

const TIPOS = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

interface PropriedadesDoLink {
  action_link?: string;
  hashed_token?: string;
  verification_type?: string;
}

/**
 * Link do e-mail no nosso domínio, a partir do que o generateLink devolveu.
 * Sem hashed_token ou com tipo desconhecido, cai no action_link de sempre
 * (que continua funcionando, só que no navegador). `next` é caminho interno.
 */
export function linkDeEmailPelaPolia(
  propriedades: PropriedadesDoLink | null | undefined,
  next: string,
): string | null {
  const token = propriedades?.hashed_token;
  const tipo = propriedades?.verification_type;
  if (!token || !tipo || !TIPOS.has(tipo)) return propriedades?.action_link ?? null;
  const params = new URLSearchParams({ token_hash: token, type: tipo });
  if (next.startsWith("/") && !next.startsWith("//")) params.set("next", next);
  return `${SITE_POLIA}/auth/link?${params.toString()}`;
}
