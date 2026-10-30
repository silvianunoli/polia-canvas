// Chamadas HTTP da Agenda das redes (ONE-154), sem ler ambiente: quem chama passa
// as credenciais. Usado pelo Worker (src/lib/redesSociaisApi.ts, process.env) e
// pela edge function redes-token-renovar (Deno.env). Só fetch, que existe nos dois.
//
// Toda chamada tem prazo de 10 s. Nenhum token vai para log: em erro, só o status
// e o código que a rede devolveu.

import {
  INSTAGRAM_GRAPH,
  INSTAGRAM_TROCA,
  INSTAGRAM_VERSAO,
  TIKTOK_API,
  perfilInstagramDaResposta,
  perfilTiktokDaResposta,
  tokenCurtoInstagram,
  tokenLongoInstagram,
  tokensTiktokDaResposta,
  type PerfilRede,
  type RespostaTokenTiktok,
  type RespostaTrocaInstagram,
  type TokensTiktok,
} from "./redesSociais.ts";

export const PRAZO_CHAMADA_MS = 10_000;

export type CredenciaisTiktok = { clientKey: string; clientSecret: string };
export type CredenciaisInstagram = { appId: string; appSecret: string };

type Resultado<T> = {
  valor: T | null;
  error: string | null;
  /** A rede respondeu e recusou (400/401): a autorização caiu de vez. */
  recusado: boolean;
};

async function lerJson(res: Response): Promise<Record<string, unknown>> {
  return ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
}

// ── TikTok ────────────────────────────────────────────────────────────────
export type PedidoTokenTiktok =
  | { grant: "authorization_code"; code: string; redirectUri: string }
  | { grant: "refresh_token"; refreshToken: string };

export async function pedirTokenTiktok(
  cred: CredenciaisTiktok,
  pedido: PedidoTokenTiktok,
  agora: number = Date.now(),
): Promise<Resultado<TokensTiktok>> {
  const corpo = new URLSearchParams({
    client_key: cred.clientKey,
    client_secret: cred.clientSecret,
    grant_type: pedido.grant,
    ...(pedido.grant === "authorization_code"
      ? { code: pedido.code, redirect_uri: pedido.redirectUri }
      : { refresh_token: pedido.refreshToken }),
  });
  try {
    const res = await fetch(`${TIKTOK_API}/oauth/token/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: corpo.toString(),
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    });
    const r = (await lerJson(res)) as RespostaTokenTiktok;
    const tokens = res.ok ? tokensTiktokDaResposta(r, agora) : null;
    if (!tokens) {
      console.warn("TikTok token:", res.status, r.error);
      // invalid_grant e afins vêm com 200 ou 400: os dois são recusa definitiva.
      const recusado = res.status === 400 || res.status === 401 || (res.ok && !!r.error);
      return {
        valor: null,
        error: "O TikTok não confirmou a autorização. Tenta conectar de novo.",
        recusado,
      };
    }
    return { valor: tokens, error: null, recusado: false };
  } catch {
    return {
      valor: null,
      error: "A Pólia One não conseguiu falar com o TikTok agora.",
      recusado: false,
    };
  }
}

/**
 * Quem é a conta: o /user/info dá o open_id e a foto (escopo user.info.basic) e o
 * creator_info dá o @ (escopo video.publish). Falhar aqui não derruba a conexão:
 * o nome é rótulo da tela.
 */
export async function perfilTiktok(accessToken: string): Promise<PerfilRede> {
  const cabecalho = { authorization: `Bearer ${accessToken}` };
  const [info, criadora] = await Promise.all([
    fetch(`${TIKTOK_API}/user/info/?fields=open_id,avatar_url,display_name`, {
      headers: cabecalho,
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    })
      .then((r) => (r.ok ? lerJson(r) : null))
      .catch(() => null),
    fetch(`${TIKTOK_API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: { ...cabecalho, "content-type": "application/json; charset=UTF-8" },
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    })
      .then((r) => (r.ok ? lerJson(r) : null))
      .catch(() => null),
  ]);
  return perfilTiktokDaResposta(
    info as { data?: { user?: Record<string, unknown> } } | null,
    criadora as { data?: Record<string, unknown> } | null,
  );
}

/** Desconectar tira a autorização no TikTok também. Melhor esforço: não trava a saída. */
export async function revogarTiktok(
  cred: CredenciaisTiktok,
  accessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${TIKTOK_API}/oauth/revoke/`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: cred.clientKey,
        client_secret: cred.clientSecret,
        token: accessToken,
      }).toString(),
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Instagram ─────────────────────────────────────────────────────────────
export type TokenInstagram = {
  accessToken: string;
  accessExpiraEm: string;
  userId: string;
  escopos: string;
};

/** code → token curto (1 h) → token longo (60 dias). Os dois passos ou nada. */
export async function trocarCodigoInstagram(
  cred: CredenciaisInstagram,
  code: string,
  redirectUri: string,
  agora: number = Date.now(),
): Promise<Resultado<TokenInstagram>> {
  const falha = (recusado: boolean): Resultado<TokenInstagram> => ({
    valor: null,
    error: "O Instagram não confirmou a autorização. Tenta conectar de novo.",
    recusado,
  });
  try {
    const res = await fetch(INSTAGRAM_TROCA, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cred.appId,
        client_secret: cred.appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }).toString(),
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    });
    const curto = res.ok
      ? tokenCurtoInstagram((await lerJson(res)) as RespostaTrocaInstagram)
      : null;
    if (!curto) {
      console.warn("Instagram troca do code:", res.status);
      return falha(res.status === 400 || res.status === 401);
    }

    // O token vai na URL porque é assim que a Meta define esta chamada (GET).
    const q = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: cred.appSecret,
      access_token: curto.accessToken,
    });
    const resLongo = await fetch(`${INSTAGRAM_GRAPH}/access_token?${q.toString()}`, {
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    });
    const longo = resLongo.ok ? tokenLongoInstagram(await lerJson(resLongo), agora) : null;
    if (!longo) {
      console.warn("Instagram token longo:", resLongo.status);
      return falha(resLongo.status === 400 || resLongo.status === 401);
    }
    return {
      valor: { ...longo, userId: curto.userId, escopos: curto.escopos },
      error: null,
      recusado: false,
    };
  } catch {
    return {
      valor: null,
      error: "A Pólia One não conseguiu falar com o Instagram agora.",
      recusado: false,
    };
  }
}

/** Renova o token longo (só funciona com mais de 24 h de vida e ainda válido). */
export async function renovarInstagram(
  accessToken: string,
  agora: number = Date.now(),
): Promise<Resultado<{ accessToken: string; accessExpiraEm: string }>> {
  try {
    const q = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken });
    const res = await fetch(`${INSTAGRAM_GRAPH}/refresh_access_token?${q.toString()}`, {
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    });
    const longo = res.ok ? tokenLongoInstagram(await lerJson(res), agora) : null;
    if (!longo) {
      console.warn("Instagram renovação:", res.status);
      return {
        valor: null,
        error: "O Instagram não renovou a autorização.",
        recusado: res.status === 400 || res.status === 401,
      };
    }
    return { valor: longo, error: null, recusado: false };
  } catch {
    return {
      valor: null,
      error: "A Pólia One não conseguiu falar com o Instagram agora.",
      recusado: false,
    };
  }
}

export async function perfilInstagram(accessToken: string): Promise<PerfilRede> {
  const q = new URLSearchParams({
    fields: "user_id,username,name,profile_picture_url,account_type",
    access_token: accessToken,
  });
  try {
    const res = await fetch(`${INSTAGRAM_GRAPH}/${INSTAGRAM_VERSAO}/me?${q.toString()}`, {
      signal: AbortSignal.timeout(PRAZO_CHAMADA_MS),
    });
    return perfilInstagramDaResposta(res.ok ? await lerJson(res) : null);
  } catch {
    return perfilInstagramDaResposta(null);
  }
}
