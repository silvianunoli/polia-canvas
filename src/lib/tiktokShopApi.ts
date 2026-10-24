// Cliente TikTok Shop (OAuth + Open API) — roda só no servidor.
// Requer TIKTOK_SHOP_APP_KEY / _APP_SECRET / _REDIRECT_URI no ambiente:
// .env em dev, secret do Worker em prod. O secret NUNCA tem prefixo VITE_.
// Regras puras (assinatura, status, vínculo) em supabase/functions/_shared/tiktokShop.ts.

import {
  urlDeAutorizacao,
  type ProdutoApiTiktok,
} from "../../supabase/functions/_shared/tiktokShop.ts";
import {
  chamarApiTiktok,
  detalheProdutoTiktok,
  pedirTokenTiktok,
  type TokensTiktok,
} from "../../supabase/functions/_shared/tiktokShopCliente.ts";

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
  if (!credenciais()) return { url: null, error: SEM_CONFIG };
  return { url: urlDeAutorizacao(SERVICE_ID, state), error: null };
}

export type { TokensTiktok };

const SEM_CONFIG = "A integração com o TikTok Shop ainda não está configurada.";

export const trocarCodigoPorTokens = async (code: string) => {
  const cred = credenciais();
  return cred
    ? pedirTokenTiktok(cred, "authorized_code", code)
    : { tokens: null, error: SEM_CONFIG };
};
export const renovarTokens = async (refreshToken: string) => {
  const cred = credenciais();
  return cred
    ? pedirTokenTiktok(cred, "refresh_token", refreshToken)
    : { tokens: null, error: SEM_CONFIG };
};

/** Chamada assinada à Open API. `shopCipher` vai em toda chamada de dado da loja. */
export async function chamarApi<T>(p: Parameters<typeof chamarApiTiktok>[1]) {
  const cred = credenciais();
  if (!cred) return { data: null as T | null, error: SEM_CONFIG };
  return chamarApiTiktok<T>(cred, p);
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

/** Uma página de produtos ativos da loja (Search Products 202502, até 100 por página). */
export async function buscarProdutos(p: {
  accessToken: string;
  shopCipher: string;
  pageToken?: string;
}) {
  const r = await chamarApi<{ products?: ProdutoApiTiktok[]; next_page_token?: string }>({
    metodo: "POST",
    path: "/product/202502/products/search",
    accessToken: p.accessToken,
    shopCipher: p.shopCipher,
    query: { page_size: "100", ...(p.pageToken ? { page_token: p.pageToken } : {}) },
    corpo: { status: "ACTIVATE" },
  });
  return {
    produtos: r.data?.products ?? [],
    proximaPagina: r.data?.next_page_token || null,
    error: r.error,
  };
}

/** Get Product: traz o nome de cada variação (sales_attributes) que a busca às vezes não traz. */
export async function detalheProduto(p: {
  accessToken: string;
  shopCipher: string;
  produtoId: string;
}) {
  const cred = credenciais();
  if (!cred) return { produto: null, error: SEM_CONFIG };
  return detalheProdutoTiktok(cred, p);
}
