// Regras puras do TikTok Shop (Fase 3a, VND-05). Sem rede nem banco: usadas pelo
// Worker (conectar, ligar anúncios) e pelas edge functions (webhook, sync), e
// testadas em src/lib/tiktokShop.test.ts. Plano: docs/plano-fase3a-tiktok-shop.md.
//
// Assinatura e webhook seguem a doc do Partner Center lida em 23/10/2026
// ("Sign your API request" e "Webhooks > Configuration guide").

export const TIKTOK_AUTORIZAR_URL = "https://services.tiktokshop.com/open/authorize";
export const TIKTOK_AUTH_API = "https://auth.tiktok-shops.com";
export const TIKTOK_OPEN_API = "https://open-api.tiktokglobalshop.com";

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(chave: string, mensagem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(chave),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(mensagem)));
}

/**
 * Texto que entra na assinatura de uma chamada: parâmetros da query em ordem
 * alfabética (sem `sign` e `access_token`) como chave+valor, precedidos do path
 * e seguidos do corpo exato que vai ser enviado, tudo entre dois app_secret.
 */
export function textoDaAssinatura(p: {
  path: string;
  query: Record<string, string>;
  body?: string;
  appSecret: string;
}): string {
  const params = Object.keys(p.query)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort()
    .map((k) => `${k}${p.query[k]}`)
    .join("");
  return `${p.appSecret}${p.path}${params}${p.body ?? ""}${p.appSecret}`;
}

export function assinarChamada(p: {
  path: string;
  query: Record<string, string>;
  body?: string;
  appSecret: string;
}): Promise<string> {
  return hmacSha256Hex(p.appSecret, textoDaAssinatura(p));
}

function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * Webhook: HMAC-SHA256 de `{app_key}{corpo cru}` com o app_secret, em hex
 * minúsculo, no cabeçalho Authorization. O corpo precisa ser o texto exato que
 * chegou: reformatar o JSON muda a assinatura.
 */
export async function webhookAutentico(p: {
  appKey: string;
  appSecret: string;
  corpoCru: string;
  assinatura: string | null;
}): Promise<boolean> {
  if (!p.assinatura) return false;
  const esperada = await hmacSha256Hex(p.appSecret, `${p.appKey}${p.corpoCru}`);
  return iguaisEmTempoConstante(esperada, p.assinatura.trim().toLowerCase());
}

export function urlDeAutorizacao(serviceId: string, state: string): string {
  const q = new URLSearchParams({ service_id: serviceId, state });
  return `${TIKTOK_AUTORIZAR_URL}?${q.toString()}`;
}

// ── Pedido → venda ─────────────────────────────────────────────────────────

/** Status de venda na Pólia que um pedido do TikTok gera, ou null quando ainda não é venda. */
export type StatusVendaCanal = "a_receber" | "cancelada" | null;

const PEDIDO_PAGO = new Set([
  // ON_HOLD: pago, no prazo em que a compradora ainda pode cancelar. O estoque já
  // está reservado no TikTok, então baixa na Pólia também; se cancelar, devolve.
  "ON_HOLD",
  "AWAITING_SHIPMENT",
  "PARTIALLY_SHIPPING",
  "AWAITING_COLLECTION",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
]);

/**
 * Pago vira venda "a receber" (o TikTok só repassa depois da entrega). Não pago
 * não entra. Cancelado vira "cancelada", que só tem efeito se já era venda.
 */
export function statusVendaDoPedido(statusTikTok: string | null | undefined): StatusVendaCanal {
  if (!statusTikTok) return null;
  if (statusTikTok === "CANCELLED") return "cancelada";
  if (PEDIDO_PAGO.has(statusTikTok)) return "a_receber";
  return null;
}

// ── Sugestão de vínculo anúncio ↔ produto ──────────────────────────────────

export interface AnuncioCanal {
  produtoExternoId: string;
  skuExternoId: string;
  /** Código que a vendedora deu à variação no TikTok (seller_sku). */
  codigo: string | null;
  titulo: string;
  variacao: string | null;
}

export interface SkuPolia {
  skuId: string;
  codigo: string | null;
  produtoNome: string;
  variacao: string | null;
}

export interface SugestaoVinculo {
  skuExternoId: string;
  skuId: string | null;
  motivo: "codigo" | "nome" | null;
}

function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pelo código (SKU) primeiro; sem código igual, pelo nome do produto + variação.
 * Só sugere quando o par é único dos dois lados: duas variações da Pólia com o
 * mesmo nome não viram palpite. Quem decide é ela, na prévia.
 */
export function sugerirVinculos(anuncios: AnuncioCanal[], skus: SkuPolia[]): SugestaoVinculo[] {
  const porCodigo = new Map<string, SkuPolia[]>();
  const porNome = new Map<string, SkuPolia[]>();
  for (const s of skus) {
    const c = normalizar(s.codigo);
    if (c) porCodigo.set(c, [...(porCodigo.get(c) ?? []), s]);
    const n = `${normalizar(s.produtoNome)}|${normalizar(s.variacao)}`;
    porNome.set(n, [...(porNome.get(n) ?? []), s]);
  }

  const usados = new Set<string>();
  const resultado: SugestaoVinculo[] = anuncios.map((a) => ({
    skuExternoId: a.skuExternoId,
    skuId: null,
    motivo: null,
  }));

  const passar = (
    motivo: "codigo" | "nome",
    chave: (a: AnuncioCanal) => string,
    mapa: Map<string, SkuPolia[]>,
  ) => {
    const contagem = new Map<string, number>();
    for (const a of anuncios) {
      const k = chave(a);
      if (k) contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
    anuncios.forEach((a, i) => {
      if (resultado[i].skuId) return;
      const k = chave(a);
      if (!k || contagem.get(k) !== 1) return;
      const candidatos = (mapa.get(k) ?? []).filter((s) => !usados.has(s.skuId));
      if (candidatos.length !== 1) return;
      resultado[i] = { skuExternoId: a.skuExternoId, skuId: candidatos[0].skuId, motivo };
      usados.add(candidatos[0].skuId);
    });
  };

  passar("codigo", (a) => normalizar(a.codigo), porCodigo);
  passar(
    "nome",
    (a) => (normalizar(a.titulo) ? `${normalizar(a.titulo)}|${normalizar(a.variacao)}` : ""),
    porNome,
  );
  return resultado;
}

// ── Anúncios do TikTok → linhas da prévia ─────────────────────────────────

/** Produto como vem do Search Products (202502) ou do Get Product (202309). Tudo opcional: a API muda. */
export interface ProdutoApiTiktok {
  id?: string;
  title?: string;
  status?: string;
  skus?: Array<{
    id?: string;
    seller_sku?: string;
    price?: { sale_price?: string; tax_exclusive_price?: string; currency?: string };
    inventory?: Array<{ quantity?: number; warehouse_id?: string }>;
    sales_attributes?: Array<{ name?: string; value_name?: string }>;
  }>;
}

export interface AnuncioLinha extends AnuncioCanal {
  preco: number | null;
  quantidade: number;
  status: string | null;
}

/** Um produto do TikTok vira uma linha por SKU (variação). SKU sem id é descartado. */
export function anunciosDoProduto(p: ProdutoApiTiktok): AnuncioLinha[] {
  if (!p.id) return [];
  const skus = p.skus ?? [];
  return skus
    .filter((s) => !!s.id)
    .map((s) => {
      const atributos = (s.sales_attributes ?? [])
        .map((a) => a.value_name?.trim())
        .filter((v): v is string => !!v);
      const precoTexto = s.price?.sale_price ?? s.price?.tax_exclusive_price;
      const preco = precoTexto != null && precoTexto !== "" ? Number(precoTexto) : null;
      return {
        produtoExternoId: p.id!,
        skuExternoId: s.id!,
        codigo: s.seller_sku?.trim() || null,
        titulo: p.title?.trim() || "Anúncio sem título",
        variacao: atributos.length ? atributos.join(" / ") : null,
        preco: preco != null && Number.isFinite(preco) ? preco : null,
        quantidade: (s.inventory ?? []).reduce((t, i) => t + Math.max(0, i.quantity ?? 0), 0),
        status: p.status ?? null,
      };
    });
}

/** Produto com mais de uma variação e sem o nome delas na busca: precisa do Get Product. */
export function precisaDetalhe(p: ProdutoApiTiktok): boolean {
  const skus = p.skus ?? [];
  return skus.length > 1 && skus.some((s) => !(s.sales_attributes ?? []).length);
}

// ── Pedido do TikTok → venda da Pólia ─────────────────────────────────────

/** Pedido como vem do Get Order Detail / Search Orders (202309). Tudo opcional: a API muda. */
export interface PedidoApiTiktok {
  id?: string;
  status?: string;
  create_time?: number;
  paid_time?: number;
  line_items?: Array<{
    sku_id?: string;
    product_name?: string;
    sku_name?: string;
    seller_sku?: string;
    original_price?: string;
    sale_price?: string;
    seller_discount?: string;
    /** No 202309 cada unidade é uma linha; se um dia vier quantidade, ela vale. */
    quantity?: number;
  }>;
}

export interface ItemVendaCanal {
  sku_id: string | null;
  nome: string;
  variacao: string | null;
  quantidade: number;
  preco_unitario: number;
}

const numero = (v: string | number | undefined | null): number => {
  const n = typeof v === "number" ? v : v != null && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * Quanto a vendedora recebe por unidade: preço original menos o desconto que
 * ELA deu. Desconto da plataforma o TikTok cobre e repassa, então não entra.
 * Unidades do mesmo SKU pelo mesmo preço viram um item com quantidade.
 */
export function itensDoPedido(
  pedido: PedidoApiTiktok,
  vinculos: Map<string, string>,
): ItemVendaCanal[] {
  const grupos = new Map<string, ItemVendaCanal>();
  for (const l of pedido.line_items ?? []) {
    const original = numero(l.original_price) || numero(l.sale_price);
    const preco = centavos(Math.max(0, original - numero(l.seller_discount)));
    const qtd = Math.max(1, Math.floor(numero(l.quantity) || 1));
    const skuExterno = l.sku_id ?? "";
    const chave = `${skuExterno}|${preco}`;
    const atual = grupos.get(chave);
    if (atual) {
      atual.quantidade += qtd;
      continue;
    }
    grupos.set(chave, {
      sku_id: (skuExterno && vinculos.get(skuExterno)) || null,
      nome: l.product_name?.trim() || "Anúncio do TikTok Shop",
      variacao: l.sku_name?.trim() || null,
      quantidade: qtd,
      preco_unitario: preco,
    });
  }
  return [...grupos.values()];
}

/** Dia da venda no horário de Brasília (o Worker e o Deno rodam em UTC). */
export function dataDoPedido(segundosUnix: number | undefined, agora: Date = new Date()): string {
  const quando = segundosUnix ? new Date(segundosUnix * 1000) : agora;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(quando);
}

/**
 * Taxa estimada pela regra que ela cadastrou para o TikTok Shop (percentual +
 * fixo), nunca maior que o total. Mesma conta de taxaDaVenda em src/lib/taxas.ts
 * (centavos inteiros, meio centavo para cima); o teste confere que as duas batem.
 */
export function taxaEstimada(
  total: number,
  regra: { percentual: number; fixo: number } | null | undefined,
): number {
  if (!regra || !(total > 0)) return 0;
  const totalCents = Math.round(total * 100);
  const taxaCents =
    Math.round((totalCents * Math.round(regra.percentual * 100)) / 10_000) +
    Math.round(regra.fixo * 100);
  return Math.min(Math.max(taxaCents, 0), totalCents) / 100;
}

/** Aviso de mudança de status de pedido (type 1). Qualquer outro aviso é ignorado. */
export function pedidoDoWebhook(corpo: unknown): { shopId: string; pedidoId: string } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as {
    type?: number;
    shop_id?: string | number;
    data?: { order_id?: string | number };
  };
  if (c.type !== 1) return null;
  const shopId = c.shop_id != null ? String(c.shop_id) : "";
  const pedidoId = c.data?.order_id != null ? String(c.data.order_id) : "";
  if (!shopId || !pedidoId || shopId.length > 100 || pedidoId.length > 100) return null;
  return { shopId, pedidoId };
}
