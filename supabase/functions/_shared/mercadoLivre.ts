// Regras puras do Mercado Livre (Fase 3c, VND-30). Sem rede nem banco: usadas
// pelo Worker (conectar, ligar anúncios) e pelas edge functions (aviso, sync), e
// testadas em src/lib/mercadoLivre.test.ts. Plano: docs/plano-fase3c-mercado-livre.md.
//
// Formatos de pedido, anúncio e aviso seguem a doc do Mercado Livre (busca de
// 24/10/2026; a leitura direta devolveu 403). O que está marcado "conferir" se
// confirma com os usuários de teste na 3c.3.

import {
  diaEmBrasilia,
  type AnuncioLinha,
  type ItemVendaCanal,
  type StatusVendaCanal,
} from "./canais.ts";

export const ML_AUTORIZAR_URL = "https://auth.mercadolivre.com.br/authorization";
export const ML_API = "https://api.mercadolibre.com";

// ── Autorização (OAuth 2.0 com PKCE) ──────────────────────────────────────

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  let bin = "";
  for (const b of bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Verificador do PKCE: 48 bytes aleatórios em base64url = 64 caracteres (RFC 7636 aceita 43 a 128). */
export function gerarVerificadorPkce(
  aleatorio: Uint8Array = crypto.getRandomValues(new Uint8Array(48)),
): string {
  return base64Url(aleatorio);
}

/** Desafio S256: SHA-256 do verificador em base64url, sem "=" no fim. */
export async function desafioPkce(verificador: string): Promise<string> {
  return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador)));
}

export function urlDeAutorizacao(p: {
  clientId: string;
  redirectUri: string;
  state: string;
  desafio: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    state: p.state,
    code_challenge: p.desafio,
    code_challenge_method: "S256",
  });
  return `${ML_AUTORIZAR_URL}?${q.toString()}`;
}

/** Resposta do POST /oauth/token. Tudo opcional: a API muda. */
export interface RespostaTokenMl {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
}

export interface TokensMl {
  accessToken: string;
  refreshToken: string;
  accessExpiraEm: string;
  /** Vendedora no Mercado Livre: vira o shop_id da conexão. */
  vendedoraId: string;
}

/**
 * O token de acesso vale 6 horas (expires_in em segundos). O de renovação não
 * tem validade na resposta: vale até ser usado uma vez ou a autorização cair.
 * Sem refresh_token (faltou o escopo offline_access) a conexão não se sustenta.
 */
export function tokensDaResposta(r: RespostaTokenMl, agora: Date = new Date()): TokensMl | null {
  const vendedoraId = r.user_id != null ? String(r.user_id) : "";
  if (!r.access_token || !r.refresh_token || !vendedoraId || vendedoraId.length > 100) return null;
  const segundos = typeof r.expires_in === "number" && r.expires_in > 0 ? r.expires_in : 6 * 3600;
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    accessExpiraEm: new Date(agora.getTime() + segundos * 1000).toISOString(),
    vendedoraId,
  };
}

// ── Pedido → venda ─────────────────────────────────────────────────────────

/** Pedido como vem do GET /orders/{id}. Tudo opcional: a API muda. */
export interface PedidoApiMl {
  id?: number | string;
  status?: string;
  date_created?: string;
  date_closed?: string;
  tags?: string[];
  /** Quem vendeu. A venda só entra se for a vendedora conectada (revisão 3c.5). */
  seller?: { id?: number | string | null } | null;
  shipping?: { id?: number | string | null } | null;
  order_items?: Array<{
    item?: {
      id?: string;
      title?: string;
      variation_id?: number | string | null;
      seller_sku?: string | null;
      variation_attributes?: Array<{ name?: string; value_name?: string | null }>;
    };
    quantity?: number;
    unit_price?: number;
    /** Tarifa de venda do item (conferir na 3c.3 se é por unidade, como a doc indica). */
    sale_fee?: number;
  }>;
}

/**
 * Pago vira venda "a receber" (o Mercado Livre libera o dinheiro depois da
 * entrega). Pagamento pendente não entra. Cancelado, ou marcado como fraude
 * pelo próprio Mercado Livre, vira "cancelada", que só tem efeito se já era venda.
 * Devolução parcial (partially_refunded) continua venda: a tela avisa.
 */
export function statusVendaDoPedido(p: Pick<PedidoApiMl, "status" | "tags">): StatusVendaCanal {
  if ((p.tags ?? []).includes("fraud_risk_detected")) return "cancelada";
  if (p.status === "cancelled") return "cancelada";
  if (p.status === "paid" || p.status === "partially_refunded") return "a_receber";
  return null;
}

const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Chave do vínculo: anúncio, mais a variação quando o anúncio tem variações. */
export function skuExternoDe(
  itemId: string,
  variacaoId: number | string | null | undefined,
): string {
  return variacaoId != null && variacaoId !== "" ? `${itemId}:${variacaoId}` : itemId;
}

/** Itens no formato da registrar_venda_canal; o vínculo vem pela chave de skuExternoDe. */
export function itensDoPedido(
  pedido: PedidoApiMl,
  vinculos: Map<string, string>,
): ItemVendaCanal[] {
  return (pedido.order_items ?? [])
    .filter((l) => !!l.item?.id)
    .map((l) => {
      const chave = skuExternoDe(l.item!.id!, l.item!.variation_id);
      const atributos = (l.item!.variation_attributes ?? [])
        .map((a) => a.value_name?.trim())
        .filter((v): v is string => !!v);
      return {
        sku_id: vinculos.get(chave) ?? null,
        nome: l.item!.title?.trim() || "Anúncio do Mercado Livre",
        variacao: atributos.length ? atributos.join(" / ") : null,
        quantidade: Math.max(1, Math.floor(numero(l.quantity) || 1)),
        preco_unitario: centavos(Math.max(0, numero(l.unit_price))),
      };
    });
}

/** Tarifa real do pedido: sale_fee de cada item vezes a quantidade, em centavos. */
export function tarifaDoPedido(pedido: PedidoApiMl): number {
  const total = (pedido.order_items ?? []).reduce(
    (t, l) =>
      t + Math.max(0, numero(l.sale_fee)) * Math.max(1, Math.floor(numero(l.quantity) || 1)),
    0,
  );
  return centavos(total);
}

/** Dia da venda em Brasília: quando fechou (pagou), senão quando foi criado. */
export function dataDoPedido(pedido: PedidoApiMl, agora: Date = new Date()): string {
  const texto = pedido.date_closed || pedido.date_created;
  const quando = texto ? new Date(texto) : agora;
  return diaEmBrasilia(Number.isNaN(quando.getTime()) ? agora : quando);
}

/** Resposta do GET /shipments/{id}/costs. Tudo opcional: a API muda. */
export interface CustosEnvioApiMl {
  senders?: Array<{ user_id?: number | string; cost?: number }>;
}

/**
 * O que o envio custou para a vendedora: a parte dela (sender) nos custos do
 * envio. Frete grátis para a compradora costuma cair aqui; frete pago pela
 * compradora não passa pelo caixa dela. null quando a resposta não diz.
 */
export function custoEnvioDaVendedora(
  custos: CustosEnvioApiMl | null | undefined,
  vendedoraId: string,
): number | null {
  const senders = custos?.senders;
  if (!Array.isArray(senders)) return null;
  const dela = senders.filter((s) => s.user_id == null || String(s.user_id) === vendedoraId);
  if (!dela.length) return 0;
  return centavos(dela.reduce((t, s) => t + Math.max(0, numero(s.cost)), 0));
}

/** Observação da venda: o número do pedido e os anúncios ainda sem produto ligado. */
export function observacaoDoPedido(
  pedidoId: string,
  itens: ItemVendaCanal[],
  frete: { naoLido: boolean; envioId: string | null },
): string {
  const semVinculo = [...new Set(itens.filter((i) => !i.sku_id).map((i) => i.nome))];
  return [
    `Pedido ${pedidoId} do Mercado Livre`,
    frete.envioId ? marcaDoEnvio(frete.envioId) : null,
    semVinculo.length ? `sem produto ligado: ${semVinculo.join(", ")}` : null,
    frete.naoLido ? "frete do envio não lido, confere no Mercado Livre" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Marca do envio na observação da venda. Pedidos do mesmo carrinho (pack) podem
 * dividir um envio: o frete entra só na primeira venda com essa marca, para não
 * contar duas vezes.
 */
export function marcaDoEnvio(envioId: string): string {
  return `envio ${envioId}`;
}

/** O pedido é da vendedora conectada? Pedido em que ela é a compradora não vira venda. */
export function pedidoDaVendedora(
  pedido: Pick<PedidoApiMl, "seller">,
  vendedoraId: string,
): boolean {
  const id = pedido.seller?.id;
  return id != null && String(id) === vendedoraId;
}

// ── Aviso (notificação) ───────────────────────────────────────────────────

/**
 * O aviso do Mercado Livre não é assinado. Só serve para pôr um id na fila: a
 * venda nasce do pedido buscado na API com o token da vendedora. Aceita só
 * orders_v2 do próprio app, com vendedora e pedido em formato de número.
 */
export function pedidoDoAviso(
  corpo: unknown,
  appId: string,
): { vendedoraId: string; pedidoId: string } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as {
    topic?: string;
    resource?: string;
    user_id?: number | string;
    application_id?: number | string;
  };
  if (c.topic !== "orders_v2") return null;
  if (c.application_id == null || String(c.application_id) !== appId) return null;
  const vendedoraId = c.user_id != null ? String(c.user_id) : "";
  const m = /^\/orders\/(\d{1,20})$/.exec(c.resource ?? "");
  if (!/^\d{1,20}$/.test(vendedoraId) || !m) return null;
  return { vendedoraId, pedidoId: m[1] };
}

// ── Anúncios ──────────────────────────────────────────────────────────────

/** Anúncio como vem do GET /items/{id}. Tudo opcional: a API muda. */
export interface AnuncioApiMl {
  id?: string;
  title?: string;
  status?: string;
  price?: number;
  available_quantity?: number;
  seller_custom_field?: string | null;
  shipping?: { logistic_type?: string | null } | null;
  attributes?: Array<{ id?: string; value_name?: string | null }>;
  variations?: Array<{
    id?: number | string;
    price?: number;
    available_quantity?: number;
    seller_custom_field?: string | null;
    attribute_combinations?: Array<{ name?: string; value_name?: string | null }>;
    attributes?: Array<{ id?: string; value_name?: string | null }>;
  }>;
}

/** Full: o estoque fica no galpão do Mercado Livre e a API não deixa mexer. */
export function anuncioNoFull(a: Pick<AnuncioApiMl, "shipping">): boolean {
  return a.shipping?.logistic_type === "fulfillment";
}

type Atributos = Array<{ id?: string; value_name?: string | null }> | undefined;

/** Código que a vendedora deu (atributo SELLER_SKU, ou o campo antigo seller_custom_field). */
function codigoDe(atributos: Atributos, campoAntigo: string | null | undefined): string | null {
  const sku = (atributos ?? []).find((a) => a.id === "SELLER_SKU")?.value_name?.trim();
  return (sku || campoAntigo?.trim() || "").slice(0, 60) || null;
}

const precoOuNulo = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
const qtd = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;

/**
 * Um anúncio vira uma linha por variação; sem variação, uma linha com o próprio
 * anúncio. A chave (skuExternoDe) é a mesma que o pedido usa para achar o vínculo.
 * Anúncio no Full sai marcado: a Pólia mostra o estoque, mas não manda quantidade.
 */
export function anunciosDoItem(a: AnuncioApiMl): AnuncioLinha[] {
  if (!a.id) return [];
  const base = {
    produtoExternoId: a.id,
    titulo: a.title?.trim() || "Anúncio sem título",
    status: a.status ?? null,
    estoqueDoCanal: anuncioNoFull(a),
  };
  const variacoes = (a.variations ?? []).filter((v) => v.id != null && v.id !== "");
  if (!variacoes.length)
    return [
      {
        ...base,
        skuExternoId: skuExternoDe(a.id, null),
        codigo: codigoDe(a.attributes, a.seller_custom_field),
        variacao: null,
        preco: precoOuNulo(a.price),
        quantidade: qtd(a.available_quantity),
      },
    ];
  return variacoes.map((v) => {
    const nomes = (v.attribute_combinations ?? [])
      .map((c) => c.value_name?.trim())
      .filter((n): n is string => !!n);
    return {
      ...base,
      skuExternoId: skuExternoDe(a.id!, v.id),
      codigo: codigoDe(v.attributes, v.seller_custom_field),
      variacao: nomes.length ? nomes.join(" / ").slice(0, 80) : null,
      preco: precoOuNulo(v.price) ?? precoOuNulo(a.price),
      quantidade: qtd(v.available_quantity),
    };
  });
}

// ── Estoque Pólia → Mercado Livre (etapa 3c.4) ────────────────────────────

/** Desfaz a chave do vínculo: anúncio e, se tiver, a variação. Chave estranha vira null. */
export function alvoDoEstoque(
  skuExternoId: string,
): { itemId: string; variacaoId: string | null } | null {
  const m = /^(MLB\d{1,20})(?::(\d{1,20}))?$/.exec(skuExternoId.trim());
  if (!m) return null;
  return { itemId: m[1], variacaoId: m[2] ?? null };
}

/**
 * Quantidade que vai para o anúncio: o SALDO da Pólia (não a diferença), negativo
 * como zero, fração para baixo. Zero pausa o anúncio no Mercado Livre e acima de
 * zero reativa: a tela avisa antes de ela ligar.
 */
export function quantidadeParaCanal(saldo: number): number {
  return Math.max(0, Math.floor(Number.isFinite(saldo) ? saldo : 0));
}
