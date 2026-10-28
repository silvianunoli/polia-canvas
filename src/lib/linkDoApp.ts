// Login dentro do app Android (AND-09, plano docs/plano-login-no-app.md,
// aprovado pela Sil em 28/10/2026). O app é o site numa WebView; aqui só a
// regra pura de dois caminhos de volta pro app:
//
// 1. Google: o Google não deixa entrar dentro de WebView, então o app abre o
//    login no navegador do celular e o Supabase devolve pra
//    `br.com.usepolia.app://entrar#access_token=...&refresh_token=...`.
// 2. Links de e-mail (App Links): o Android abre
//    `https://one.usepolia.com.br/auth/link?...` direto no app, e a WebView
//    precisa ir pra esse caminho.
//
// A gravação da sessão, o navegador e o ouvinte ficam em lib/appNativo.ts.

export const ESQUEMA_APP = "br.com.usepolia.app";
export const URL_RETORNO_GOOGLE = `${ESQUEMA_APP}://entrar`;
export const DOMINIO_DO_APP = "one.usepolia.com.br";

export type RetornoDoApp =
  | { tipo: "sessao"; accessToken: string; refreshToken: string }
  | { tipo: "cancelado" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "caminho"; caminho: string }
  | { tipo: "ignorar" };

/** Caminho interno seguro: começa com "/" e não com "//" (bloqueia domínio externo). */
export function caminhoSeguro(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

/**
 * O que fazer com a URL que abriu o app (evento `appUrlOpen`).
 * - `br.com.usepolia.app://entrar#access_token=...` vira sessão;
 *   `#error=access_denied` (desistiu no Google) vira cancelado; outro erro, erro.
 * - `https://one.usepolia.com.br/...` vira o caminho pra WebView abrir.
 * - Qualquer outra coisa é ignorada.
 */
export function lerRetornoDoApp(url: string): RetornoDoApp {
  if (url.startsWith(`${ESQUEMA_APP}://`)) {
    const resto = url.slice(`${ESQUEMA_APP}://`.length);
    const i = resto.search(/[#?]/);
    const host = (i < 0 ? resto : resto.slice(0, i)).replace(/\/+$/, "");
    if (host !== "entrar") return { tipo: "ignorar" };
    // O Supabase (fluxo implícito) devolve no hash; erro pode vir no hash ou na query.
    const params = new URLSearchParams();
    const pedaco = i < 0 ? "" : resto.slice(i);
    for (const parte of pedaco.split(/[#?]/)) {
      if (!parte) continue;
      new URLSearchParams(parte).forEach((v, k) => params.set(k, v));
    }
    const erro = params.get("error");
    if (erro) {
      return erro === "access_denied"
        ? { tipo: "cancelado" }
        : { tipo: "erro", mensagem: params.get("error_description") ?? erro };
    }
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      return { tipo: "erro", mensagem: "retorno sem sessão" };
    }
    return { tipo: "sessao", accessToken, refreshToken };
  }

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { tipo: "ignorar" };
  }
  if (u.protocol !== "https:" || u.hostname !== DOMINIO_DO_APP) return { tipo: "ignorar" };
  const caminho = caminhoSeguro(`${u.pathname}${u.search}${u.hash}`);
  return caminho ? { tipo: "caminho", caminho } : { tipo: "ignorar" };
}

// ── Links de e-mail pelo nosso domínio (/auth/link) ──

/** Tipos que o verifyOtp aceita com token_hash e que a Pólia manda por e-mail. */
export const TIPOS_DE_LINK = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;
export type TipoDeLink = (typeof TIPOS_DE_LINK)[number];

export function ehTipoDeLink(v: unknown): v is TipoDeLink {
  return typeof v === "string" && (TIPOS_DE_LINK as readonly string[]).includes(v);
}

/** Pra onde o link leva depois de confirmar, quando o e-mail não diz (`next`). */
export function destinoPadraoDoLink(tipo: TipoDeLink): string {
  if (tipo === "invite") return "/auth/criar-senha";
  if (tipo === "recovery") return "/auth/redefinir-senha";
  if (tipo === "email_change") return "/configuracoes";
  return "/painel";
}

/** Qual tela de "link expirado" cabe, pelo tipo do link. */
export function tipoDoLinkExpirado(
  tipo: TipoDeLink,
  destino: string,
): "confirmacao" | "redefinicao" | "convite" {
  if (tipo === "recovery") return "redefinicao";
  if (tipo === "invite" || destino.startsWith("/auth/criar-senha")) return "convite";
  return "confirmacao";
}
