// Cliente HTTP do Mercado Livre (Fase 3c, VND-30), sem ler ambiente: quem chama
// passa as credenciais. Usado pelo Worker (src/lib/mercadoLivreApi.ts, que lê
// process.env) e pelas edge functions (Deno.env). Só fetch, que existe nos dois.
//
// Token de renovação de USO ÚNICO: cada renovação devolve um novo e o antigo
// morre. Quem renova precisa gravar o novo antes de qualquer outra coisa.

import { ML_API, tokensDaResposta, type RespostaTokenMl, type TokensMl } from "./mercadoLivre.ts";

export type CredenciaisMl = { clientId: string; clientSecret: string };

export type PedidoToken =
  | { grant: "authorization_code"; code: string; verificador: string; redirectUri: string }
  | { grant: "refresh_token"; refreshToken: string };

export async function pedirTokenMl(
  cred: CredenciaisMl,
  pedido: PedidoToken,
): Promise<{ tokens: TokensMl | null; error: string | null }> {
  const corpo = new URLSearchParams({
    grant_type: pedido.grant,
    client_id: cred.clientId,
    client_secret: cred.clientSecret,
    ...(pedido.grant === "authorization_code"
      ? { code: pedido.code, code_verifier: pedido.verificador, redirect_uri: pedido.redirectUri }
      : { refresh_token: pedido.refreshToken }),
  });
  try {
    const res = await fetch(`${ML_API}/oauth/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: corpo.toString(),
    });
    const resposta = (await res.json().catch(() => ({}))) as RespostaTokenMl & {
      error?: string;
      message?: string;
    };
    const tokens = res.ok ? tokensDaResposta(resposta) : null;
    if (!tokens) {
      // Diagnóstico sem segredo: só o status e o código de erro do Mercado Livre.
      console.warn("Mercado Livre token:", res.status, resposta.error, resposta.message);
      return {
        tokens: null,
        error: "O Mercado Livre não confirmou a autorização. Tenta conectar de novo.",
      };
    }
    return { tokens, error: null };
  } catch {
    return { tokens: null, error: "A Pólia One não conseguiu falar com o Mercado Livre agora." };
  }
}

/** GET autenticado na API. O token vai no cabeçalho, nunca na URL. */
export async function chamarApiMl<T>(p: {
  metodo?: "GET" | "PUT";
  path: string;
  accessToken: string;
  query?: Record<string, string>;
  corpo?: unknown;
}): Promise<{ data: T | null; status: number; error: string | null }> {
  const q = p.query ? `?${new URLSearchParams(p.query).toString()}` : "";
  try {
    const res = await fetch(`${ML_API}${p.path}${q}`, {
      method: p.metodo ?? "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${p.accessToken}`,
        ...(p.corpo !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: p.corpo === undefined ? undefined : JSON.stringify(p.corpo),
    });
    const resposta = (await res.json().catch(() => null)) as
      | (T & { error?: string; message?: string })
      | null;
    if (!res.ok) {
      console.warn("Mercado Livre API:", p.path, res.status, resposta?.error, resposta?.message);
      return { data: null, status: res.status, error: resposta?.message ?? `HTTP ${res.status}` };
    }
    return { data: resposta, status: res.status, error: null };
  } catch {
    return { data: null, status: 0, error: "sem resposta do Mercado Livre" };
  }
}

export type VendedoraMl = { id: string; apelido: string };

/** Quem autorizou: id e apelido (nickname) que aparecem no card. */
export async function lerVendedoraMl(
  accessToken: string,
): Promise<{ vendedora: VendedoraMl | null; error: string | null }> {
  const r = await chamarApiMl<{ id?: number | string; nickname?: string }>({
    path: "/users/me",
    accessToken,
  });
  if (!r.data?.id) return { vendedora: null, error: r.error ?? "sem dados da conta" };
  return {
    vendedora: {
      id: String(r.data.id),
      apelido: (r.data.nickname ?? "").trim().slice(0, 200) || "Conta do Mercado Livre",
    },
    error: null,
  };
}
