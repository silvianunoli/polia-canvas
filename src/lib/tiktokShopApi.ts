// Cliente TikTok Shop (OAuth + Open API) — roda só no servidor.
// Requer TIKTOK_SHOP_APP_KEY / _APP_SECRET / _REDIRECT_URI no ambiente:
// .env em dev, secret do Worker em prod. O secret NUNCA tem prefixo VITE_.
// Regras puras (assinatura, status, vínculo) em supabase/functions/_shared/tiktokShop.ts.

import {
  TIKTOK_AUTH_API,
  TIKTOK_OPEN_API,
  assinarChamada,
  urlDeAutorizacao,
} from "../../supabase/functions/_shared/tiktokShop.ts";

// Id do app "Pólia One" no Partner Center (App & Service). Não é segredo: vai na
// URL de autorização que a vendedora abre.
const SERVICE_ID = "7699576083930793735";

function credenciais() {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;
  const redirectUri = process.env.TIKTOK_SHOP_REDIRECT_URI;
  if (!appKey || !appSecret || !redirectUri) return null;
  return { appKey, appSecret, redirectUri };
}

/** Só o booleano sai daqui: a tela esconde o TikTok Shop quando faltar variável. */
export function tiktokConfigurado(): boolean {
  return credenciais() !== null;
}

export function montarUrlAutorizacao(state: string): { url: string | null; error: string | null } {
  if (!credenciais())
    return { url: null, error: "A integração com o TikTok Shop ainda não está configurada." };
  return { url: urlDeAutorizacao(SERVICE_ID, state), error: null };
}

export type TokensTiktok = {
  accessToken: string;
  refreshToken: string;
  accessExpiraEm: string;
  refreshExpiraEm: string;
};

type RespostaToken = {
  code: number;
  message?: string;
  data?: {
    access_token: string;
    access_token_expire_in: number;
    refresh_token: string;
    refresh_token_expire_in: number;
  };
};

const segundosParaIso = (unix: number) => new Date(unix * 1000).toISOString();

async function pedirToken(
  grant: "authorized_code" | "refresh_token",
  valor: string,
): Promise<{ tokens: TokensTiktok | null; error: string | null }> {
  const cred = credenciais();
  if (!cred)
    return { tokens: null, error: "A integração com o TikTok Shop ainda não está configurada." };
  const caminho = grant === "authorized_code" ? "/api/v2/token/get" : "/api/v2/token/refresh";
  const q = new URLSearchParams({
    app_key: cred.appKey,
    app_secret: cred.appSecret,
    grant_type: grant,
    ...(grant === "authorized_code" ? { auth_code: valor } : { refresh_token: valor }),
  });
  try {
    const res = await fetch(`${TIKTOK_AUTH_API}${caminho}?${q.toString()}`);
    const corpo = (await res.json()) as RespostaToken;
    if (!res.ok || corpo.code !== 0 || !corpo.data) {
      // Diagnóstico sem segredo: só o código e a mensagem do TikTok.
      console.warn("TikTok token:", res.status, corpo.code, corpo.message);
      return {
        tokens: null,
        error: "O TikTok Shop não confirmou a autorização. Tenta conectar de novo.",
      };
    }
    return {
      tokens: {
        accessToken: corpo.data.access_token,
        refreshToken: corpo.data.refresh_token,
        accessExpiraEm: segundosParaIso(corpo.data.access_token_expire_in),
        refreshExpiraEm: segundosParaIso(corpo.data.refresh_token_expire_in),
      },
      error: null,
    };
  } catch {
    return { tokens: null, error: "A Pólia One não conseguiu falar com o TikTok Shop agora." };
  }
}

export const trocarCodigoPorTokens = (code: string) => pedirToken("authorized_code", code);
export const renovarTokens = (refreshToken: string) => pedirToken("refresh_token", refreshToken);

type RespostaApi<T> = { code: number; message?: string; data?: T };

/** Chamada assinada à Open API. `shopCipher` vai em toda chamada de dado da loja. */
export async function chamarApi<T>(p: {
  metodo: "GET" | "POST";
  path: string;
  accessToken: string;
  shopCipher?: string;
  query?: Record<string, string>;
  corpo?: unknown;
}): Promise<{ data: T | null; error: string | null }> {
  const cred = credenciais();
  if (!cred)
    return { data: null, error: "A integração com o TikTok Shop ainda não está configurada." };
  const query: Record<string, string> = {
    app_key: cred.appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
    ...(p.shopCipher ? { shop_cipher: p.shopCipher } : {}),
    ...p.query,
  };
  const body = p.corpo === undefined ? undefined : JSON.stringify(p.corpo);
  const sign = await assinarChamada({ path: p.path, query, body, appSecret: cred.appSecret });
  const url = `${TIKTOK_OPEN_API}${p.path}?${new URLSearchParams({ ...query, sign }).toString()}`;
  try {
    const res = await fetch(url, {
      method: p.metodo,
      headers: { "x-tts-access-token": p.accessToken, "content-type": "application/json" },
      body,
    });
    const resposta = (await res.json()) as RespostaApi<T>;
    if (!res.ok || resposta.code !== 0) {
      console.warn("TikTok API:", p.path, res.status, resposta.code, resposta.message);
      return { data: null, error: resposta.message ?? `HTTP ${res.status}` };
    }
    return { data: resposta.data ?? null, error: null };
  } catch {
    return { data: null, error: "sem resposta do TikTok Shop" };
  }
}

export type LojaTiktok = { id: string; name: string; region: string; cipher: string };

export async function lojasAutorizadas(accessToken: string) {
  const r = await chamarApi<{ shops?: LojaTiktok[] }>({
    metodo: "GET",
    path: "/authorization/202309/shops",
    accessToken,
  });
  return { lojas: r.data?.shops ?? [], error: r.error };
}
