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
