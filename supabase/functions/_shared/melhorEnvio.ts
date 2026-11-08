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

/** Um produto da compra na cotação, com valor e medidas lidos do cadastro. */
export interface ProdutoCotacao {
  id: string;
  quantidade: number;
  peso_kg: number;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
  valor: number;
}

/** Corpo de /api/v2/me/shipment/calculate. O próprio Melhor Envio monta os pacotes. */
export function corpoCotacao(a: { origem: string; destino: string; produtos: ProdutoCotacao[] }) {
  return {
    from: { postal_code: a.origem },
    to: { postal_code: a.destino },
    products: a.produtos.map((p) => ({
      id: p.id,
      width: p.largura_cm,
      height: p.altura_cm,
      length: p.comprimento_cm,
      weight: p.peso_kg,
      insurance_value: p.valor,
      quantity: p.quantidade,
    })),
    options: { receipt: false, own_hand: false },
  };
}

export interface OpcaoFrete {
  id: number;
  nome: string;
  empresa: string;
  preco: number;
  /** Dias úteis de transporte. */
  prazo: number;
  /** Como o Melhor Envio montou a caixa: a etiqueta precisa disto depois. */
  pacotes: Array<{ dimensoes: unknown; peso: unknown; seguro: unknown }>;
}

const numeroOuNulo = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Serviços que atendem o CEP, do mais barato ao mais caro. Serviço com erro fica de fora. */
export function opcoesDaCotacao(json: unknown): OpcaoFrete[] {
  if (!Array.isArray(json)) return [];
  const opcoes: OpcaoFrete[] = [];
  for (const bruto of json) {
    const s = (bruto ?? {}) as Record<string, unknown>;
    if (s.error) continue;
    const id = numeroOuNulo(s.id);
    const preco = numeroOuNulo(s.custom_price) ?? numeroOuNulo(s.price);
    const prazo = numeroOuNulo(s.custom_delivery_time) ?? numeroOuNulo(s.delivery_time);
    if (id == null || preco == null || preco <= 0 || prazo == null || prazo < 0) continue;
    const empresa = (s.company ?? {}) as Record<string, unknown>;
    const pacotes = Array.isArray(s.packages) ? (s.packages as Array<Record<string, unknown>>) : [];
    opcoes.push({
      id,
      nome: String(s.name ?? "Frete").slice(0, 60),
      empresa: String(empresa.name ?? "").slice(0, 60),
      preco: Math.round(preco * 100) / 100,
      prazo: Math.round(prazo),
      pacotes: pacotes.slice(0, 10).map((p) => ({ dimensoes: p.dimensions, peso: p.weight, seguro: p.insurance_value })),
    });
  }
  return opcoes.sort((a, b) => a.preco - b.preco);
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
