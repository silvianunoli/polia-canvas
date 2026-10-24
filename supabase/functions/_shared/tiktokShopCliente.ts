// Cliente HTTP do TikTok Shop (Fase 3a, VND-05), sem ler ambiente: quem chama
// passa as credenciais. Usado pelo Worker (src/lib/tiktokShopApi.ts, que lê
// process.env) e pelas edge functions (Deno.env). Só fetch e Web Crypto, que
// existem nos dois.

import {
  TIKTOK_AUTH_API,
  TIKTOK_OPEN_API,
  assinarChamada,
  type PedidoApiTiktok,
} from "./tiktokShop.ts";

export type CredenciaisTiktok = { appKey: string; appSecret: string };

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

export async function pedirTokenTiktok(
  cred: CredenciaisTiktok,
  grant: "authorized_code" | "refresh_token",
  valor: string,
): Promise<{ tokens: TokensTiktok | null; error: string | null }> {
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

type RespostaApi<T> = { code: number; message?: string; data?: T };

/** Chamada assinada à Open API. `shopCipher` vai em toda chamada de dado da loja. */
export async function chamarApiTiktok<T>(
  cred: CredenciaisTiktok,
  p: {
    metodo: "GET" | "POST";
    path: string;
    accessToken: string;
    shopCipher?: string;
    query?: Record<string, string>;
    corpo?: unknown;
  },
): Promise<{ data: T | null; error: string | null }> {
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

/** Get Order Detail: até 50 pedidos por chamada. */
export async function detalhePedidos(
  cred: CredenciaisTiktok,
  p: { accessToken: string; shopCipher: string; ids: string[] },
) {
  const r = await chamarApiTiktok<{ orders?: PedidoApiTiktok[] }>(cred, {
    metodo: "GET",
    path: "/order/202309/orders",
    accessToken: p.accessToken,
    shopCipher: p.shopCipher,
    query: { ids: p.ids.slice(0, 50).join(",") },
  });
  return { pedidos: r.data?.orders ?? [], error: r.error };
}

/** Search Orders: pedidos alterados desde um instante, do mais antigo para o mais novo. */
export async function buscarPedidosAlterados(
  cred: CredenciaisTiktok,
  p: { accessToken: string; shopCipher: string; desdeSegundos: number; pageToken?: string },
) {
  const r = await chamarApiTiktok<{ orders?: PedidoApiTiktok[]; next_page_token?: string }>(cred, {
    metodo: "POST",
    path: "/order/202309/orders/search",
    accessToken: p.accessToken,
    shopCipher: p.shopCipher,
    query: {
      page_size: "50",
      sort_field: "update_time",
      sort_order: "ASC",
      ...(p.pageToken ? { page_token: p.pageToken } : {}),
    },
    corpo: { update_time_ge: p.desdeSegundos },
  });
  return {
    pedidos: r.data?.orders ?? [],
    proximaPagina: r.data?.next_page_token || null,
    error: r.error,
  };
}
