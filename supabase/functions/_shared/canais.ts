// Regras puras que valem para qualquer canal de venda (TikTok Shop, Mercado
// Livre, Shopee). Saíram do tiktokShop.ts na Fase 3c (VND-30) para o Mercado
// Livre usar a mesma regra sem importar nada do TikTok. Sem rede nem banco:
// usadas pelo Worker e pelas edge functions, testadas em src/lib/canais.test.ts.

/** Status de venda na Pólia que um pedido do canal gera, ou null quando ainda não é venda. */
export type StatusVendaCanal = "a_receber" | "cancelada" | null;

// ── Sugestão de vínculo anúncio ↔ produto ──────────────────────────────────

export interface AnuncioCanal {
  produtoExternoId: string;
  skuExternoId: string;
  /** Código que a vendedora deu à variação no canal (seller_sku, SELLER_SKU). */
  codigo: string | null;
  titulo: string;
  variacao: string | null;
}

/** Uma linha da prévia de "Ligar anúncios": uma variação de anúncio do canal. */
export interface AnuncioLinha extends AnuncioCanal {
  preco: number | null;
  quantidade: number;
  status: string | null;
  /** Estoque cuidado pelo próprio canal (Full do Mercado Livre): a Pólia só lê. */
  estoqueDoCanal?: boolean;
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

// ── Pedido do canal → venda da Pólia ──────────────────────────────────────

/** Item no formato que a RPC registrar_venda_canal recebe. */
export interface ItemVendaCanal {
  sku_id: string | null;
  nome: string;
  variacao: string | null;
  quantidade: number;
  preco_unitario: number;
}

/** Dia no horário de Brasília (o Worker e o Deno rodam em UTC). */
export function diaEmBrasilia(quando: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(quando);
}
