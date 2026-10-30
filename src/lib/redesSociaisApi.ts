// Credenciais da Agenda das redes (ONE-154) — roda só no servidor.
// Requer no ambiente (.env em dev, secret do Worker em prod; NUNCA com VITE_):
//   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI
//   INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET / INSTAGRAM_REDIRECT_URI
// Rede sem as três variáveis some da tela. Regras puras em
// supabase/functions/_shared/redesSociais.ts; HTTP em _shared/redesSociaisCliente.ts.

import {
  urlAutorizacaoInstagram,
  urlAutorizacaoTiktok,
  type Rede,
} from "../../supabase/functions/_shared/redesSociais.ts";
import {
  perfilInstagram,
  perfilTiktok,
  pedirTokenTiktok,
  renovarInstagram,
  revogarTiktok,
  trocarCodigoInstagram,
  type CredenciaisInstagram,
  type CredenciaisTiktok,
} from "../../supabase/functions/_shared/redesSociaisCliente.ts";

type ComRedirect<T> = T & { redirectUri: string };

function credTiktok(): ComRedirect<CredenciaisTiktok> | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirectUri) return null;
  return { clientKey, clientSecret, redirectUri };
}

function credInstagram(): ComRedirect<CredenciaisInstagram> | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) return null;
  return { appId, appSecret, redirectUri };
}

/** Só o booleano sai daqui: a tela esconde a rede quando faltar variável. */
export function redeConfigurada(rede: Rede): boolean {
  return rede === "tiktok" ? credTiktok() !== null : credInstagram() !== null;
}

/**
 * Enquanto as revisões do TikTok e da Meta não aprovam, a Agenda só aparece para
 * conta admin (a Sil testando no sandbox). REDES_SOCIAIS_ABERTO=1 abre para o Pro.
 */
export function redesAbertasParaClientes(): boolean {
  return process.env.REDES_SOCIAIS_ABERTO === "1";
}

const SEM_CONFIG = "A conexão com essa rede ainda não está configurada.";

export function montarUrlAutorizacao(
  rede: Rede,
  state: string,
): { url: string | null; error: string | null } {
  if (rede === "tiktok") {
    const c = credTiktok();
    if (!c) return { url: null, error: SEM_CONFIG };
    return {
      url: urlAutorizacaoTiktok({ clientKey: c.clientKey, redirectUri: c.redirectUri, state }),
      error: null,
    };
  }
  const c = credInstagram();
  if (!c) return { url: null, error: SEM_CONFIG };
  return {
    url: urlAutorizacaoInstagram({ appId: c.appId, redirectUri: c.redirectUri, state }),
    error: null,
  };
}

export async function trocarCodigoTiktok(code: string) {
  const c = credTiktok();
  if (!c) return { valor: null, error: SEM_CONFIG, recusado: false };
  return pedirTokenTiktok(c, { grant: "authorization_code", code, redirectUri: c.redirectUri });
}

export async function renovarTokenTiktok(refreshToken: string) {
  const c = credTiktok();
  if (!c) return { valor: null, error: SEM_CONFIG, recusado: false };
  return pedirTokenTiktok(c, { grant: "refresh_token", refreshToken });
}

export async function revogarAutorizacaoTiktok(accessToken: string): Promise<boolean> {
  const c = credTiktok();
  return c ? revogarTiktok(c, accessToken) : false;
}

export async function trocarCodigoDoInstagram(code: string) {
  const c = credInstagram();
  if (!c) return { valor: null, error: SEM_CONFIG, recusado: false };
  return trocarCodigoInstagram(c, code, c.redirectUri);
}

export { perfilInstagram, perfilTiktok, renovarInstagram };
