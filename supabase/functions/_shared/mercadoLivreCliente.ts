// Cliente HTTP do Mercado Livre (Fase 3c, VND-30), sem ler ambiente: quem chama
// passa as credenciais. Usado pelo Worker (src/lib/mercadoLivreApi.ts, que lê
// process.env) e pelas edge functions (Deno.env). Só fetch, que existe nos dois.
//
// Token de renovação de USO ÚNICO: cada renovação devolve um novo e o antigo
// morre. Quem renova precisa gravar o novo antes de qualquer outra coisa.

import {
  ML_API,
  tokensDaResposta,
  type AnuncioApiMl,
  type CustosEnvioApiMl,
  type PedidoApiMl,
  type RespostaTokenMl,
  type TokensMl,
} from "./mercadoLivre.ts";

export type CredenciaisMl = { clientId: string; clientSecret: string };

export type PedidoToken =
  | { grant: "authorization_code"; code: string; verificador: string; redirectUri: string }
  | { grant: "refresh_token"; refreshToken: string };

export async function pedirTokenMl(
  cred: CredenciaisMl,
  pedido: PedidoToken,
): Promise<{
  tokens: TokensMl | null;
  error: string | null;
  /** O Mercado Livre respondeu e recusou (400/401): a autorização caiu de vez. */
  recusado: boolean;
}> {
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
        // 5xx ou resposta estranha não prova que o token morreu: tenta de novo depois.
        recusado: res.status === 400 || res.status === 401,
      };
    }
    return { tokens, error: null, recusado: false };
  } catch {
    return {
      tokens: null,
      error: "A Pólia One não conseguiu falar com o Mercado Livre agora.",
      recusado: false,
    };
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

/**
 * Uma página de ids de anúncios ATIVOS da vendedora. Sem search_type=scan o
 * Mercado Livre limita o offset a 1.000, mais que os 500 que a prévia mostra.
 */
export async function buscarIdsAnunciosMl(p: {
  accessToken: string;
  vendedoraId: string;
  offset: number;
  limite: number;
}): Promise<{ ids: string[]; total: number; error: string | null }> {
  const r = await chamarApiMl<{ results?: string[]; paging?: { total?: number } }>({
    path: `/users/${encodeURIComponent(p.vendedoraId)}/items/search`,
    accessToken: p.accessToken,
    query: { status: "active", offset: String(p.offset), limit: String(p.limite) },
  });
  return {
    ids: (r.data?.results ?? []).filter((id) => typeof id === "string"),
    total: r.data?.paging?.total ?? 0,
    error: r.error,
  };
}

const CAMPOS_ANUNCIO =
  "id,title,status,price,available_quantity,seller_custom_field,shipping,attributes,variations";

/**
 * Detalhe de até 20 anúncios (multiget). Cada um volta com o próprio código:
 * anúncio que falhou (apagado, de outra conta) fica de fora sem derrubar o lote.
 * include_attributes=all traz o SELLER_SKU das variações (conferir na 3c.2).
 */
export async function detalhesAnunciosMl(p: {
  accessToken: string;
  ids: string[];
}): Promise<{ anuncios: AnuncioApiMl[]; error: string | null }> {
  if (!p.ids.length) return { anuncios: [], error: null };
  const r = await chamarApiMl<Array<{ code?: number; body?: AnuncioApiMl }>>({
    path: "/items",
    accessToken: p.accessToken,
    query: {
      ids: p.ids.slice(0, 20).join(","),
      attributes: CAMPOS_ANUNCIO,
      include_attributes: "all",
    },
  });
  if (!Array.isArray(r.data)) return { anuncios: [], error: r.error ?? "resposta inesperada" };
  return {
    anuncios: r.data.filter((x) => x.code === 200 && x.body?.id).map((x) => x.body!),
    error: null,
  };
}

/** Pedido completo (GET /orders/{id}). */
export async function pedidoMl(p: { accessToken: string; pedidoId: string }) {
  const r = await chamarApiMl<PedidoApiMl>({
    path: `/orders/${encodeURIComponent(p.pedidoId)}`,
    accessToken: p.accessToken,
  });
  return { pedido: r.data?.id != null ? r.data : null, status: r.status, error: r.error };
}

/** Custos do envio (GET /shipments/{id}/costs), para achar o que a vendedora pagou. */
export async function custosEnvioMl(p: { accessToken: string; envioId: string }) {
  const r = await chamarApiMl<CustosEnvioApiMl>({
    path: `/shipments/${encodeURIComponent(p.envioId)}/costs`,
    accessToken: p.accessToken,
  });
  return { custos: r.data, error: r.error };
}

/**
 * Pedidos da vendedora alterados desde uma data (varredura que cobre aviso
 * perdido). Só os ids: o detalhe vem depois, pela fila.
 */
export async function pedidosAlteradosMl(p: {
  accessToken: string;
  vendedoraId: string;
  desdeIso: string;
  offset: number;
}): Promise<{ ids: string[]; total: number; error: string | null }> {
  const r = await chamarApiMl<{
    results?: Array<{ id?: number | string }>;
    paging?: { total?: number };
  }>({
    path: "/orders/search",
    accessToken: p.accessToken,
    query: {
      seller: p.vendedoraId,
      "order.date_last_updated.from": p.desdeIso,
      sort: "date_desc",
      limit: "50",
      offset: String(p.offset),
    },
  });
  return {
    ids: (r.data?.results ?? []).filter((o) => o.id != null).map((o) => String(o.id)),
    total: r.data?.paging?.total ?? 0,
    error: r.error,
  };
}

/** Só o que o envio de estoque precisa saber do anúncio: se está no Full. */
export async function estadoAnuncioMl(p: { accessToken: string; itemId: string }) {
  const r = await chamarApiMl<AnuncioApiMl>({
    path: `/items/${encodeURIComponent(p.itemId)}`,
    accessToken: p.accessToken,
    query: { attributes: "id,status,shipping" },
  });
  return { anuncio: r.data?.id ? r.data : null, error: r.error };
}

/**
 * Quantidade de um anúncio ou de UMA variação. A variação vai pelo endereço dela:
 * mandar a lista de variações no PUT do anúncio apagaria as que ficassem de fora.
 */
export async function atualizarEstoqueMl(p: {
  accessToken: string;
  itemId: string;
  variacaoId: string | null;
  quantidade: number;
}): Promise<{ error: string | null }> {
  const path = p.variacaoId
    ? `/items/${encodeURIComponent(p.itemId)}/variations/${encodeURIComponent(p.variacaoId)}`
    : `/items/${encodeURIComponent(p.itemId)}`;
  const r = await chamarApiMl<unknown>({
    metodo: "PUT",
    path,
    accessToken: p.accessToken,
    corpo: { available_quantity: p.quantidade },
  });
  return { error: r.error };
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
