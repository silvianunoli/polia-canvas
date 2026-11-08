// Regras puras da integração com o Melhor Envio (ONE-189), sem rede: usadas pela função
// melhor-envio e testadas pelo vitest do polia-app.
//
// Autorização OAuth2 com o aplicativo da Pólia na Área Dev do Melhor Envio. O token de
// acesso vale 30 dias e o de renovação 45 (doc oficial, lida em 07/11/2026).

export const MSG_RECONECTAR_ME = "A autorização do Melhor Envio venceu. Conecta de novo.";

/** O que a Pólia pede: cotar, comprar, gerar, imprimir, cancelar e rastrear etiqueta. */
export const ESCOPOS_ME = [
  "cart-read",
  "cart-write",
  "companies-read",
  "orders-read",
  "purchases-read",
  "shipping-calculate",
  "shipping-cancel",
  "shipping-checkout",
  "shipping-companies",
  "shipping-generate",
  "shipping-preview",
  "shipping-print",
  "shipping-tracking",
  "users-read",
].join(" ");

const DIA_MS = 24 * 3600 * 1000;
export const VALIDADE_RENOVACAO_DIAS = 45;
/** Renova quando faltam menos de 10 dias: sobra tempo para o cron tentar de novo. */
export const RENOVA_ANTES_DIAS = 10;

export function urlAutorizacao(a: { base: string; clientId: string; redirect: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: a.clientId,
    redirect_uri: a.redirect,
    response_type: "code",
    state: a.state,
    scope: ESCOPOS_ME,
  });
  return `${a.base.replace(/\/$/, "")}/oauth/authorize?${q.toString()}`;
}

export interface TokensMe {
  accessToken: string;
  refreshToken: string;
  accessExpiraEm: string;
  refreshExpiraEm: string;
}

/** Resposta de /oauth/token em tokens com data de vencimento. Null se veio torta. */
export function tokensDaResposta(json: unknown, agora: number): TokensMe | null {
  const r = json as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown } | null;
  if (!r || typeof r.access_token !== "string" || typeof r.refresh_token !== "string") return null;
  if (!r.access_token || !r.refresh_token) return null;
  const segundos = Number(r.expires_in);
  const validade = Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : 30 * DIA_MS;
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    accessExpiraEm: new Date(agora + validade).toISOString(),
    refreshExpiraEm: new Date(agora + VALIDADE_RENOVACAO_DIAS * DIA_MS).toISOString(),
  };
}

export function precisaRenovar(accessExpiraEm: string | null, agora: number): boolean {
  if (!accessExpiraEm) return true;
  const vence = Date.parse(accessExpiraEm);
  return !Number.isFinite(vence) || vence - agora < RENOVA_ANTES_DIAS * DIA_MS;
}

/** Nome que aparece no card: nome e sobrenome da conta, ou o e-mail. */
export function nomeDaConta(json: unknown): { id: string | null; nome: string } {
  const r = (json ?? {}) as { id?: unknown; firstname?: unknown; lastname?: unknown; email?: unknown };
  const nome = [r.firstname, r.lastname].filter((x) => typeof x === "string" && x.trim()).join(" ").trim();
  return {
    id: r.id != null ? String(r.id).slice(0, 100) : null,
    nome: (nome || (typeof r.email === "string" ? r.email : "") || "Conta do Melhor Envio").slice(0, 200),
  };
}
