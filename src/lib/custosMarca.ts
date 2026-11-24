// Custos da marca (ONE-258) e acréscimo por marketplace (ONE-259), 24/11/2026.
// Puro: a tela e o banco moram em components/financeiro/custosMarcaDados.ts.
//
// O que a Calculadora usa e não é da peça fica cadastrado uma vez no
// Financeiro: custos fixos do mês, pró-labore (o mesmo da Projeção), peças
// vendidas por mês, imposto e taxa de recebimento da venda direta. A conta de
// cada peça continua "por dentro" (precificacao.functions).

export interface CustosMarca {
  fixosMes: number;
  /** Detalhe por item (chaves de ITENS_CUSTO_FIXO), em texto como os campos. */
  fixosDetalhe: Record<string, string>;
  proLabore: number;
  /** null = ainda não preenchido. */
  pecasMes: number | null;
  impostoPct: number;
  taxaRecebimentoPct: number;
  /** % a mais no preço por marketplace: { mercado_livre: 40 }. */
  acrescimoCanais: Record<string, number>;
}

export const CUSTOS_MARCA_VAZIO: CustosMarca = {
  fixosMes: 0,
  fixosDetalhe: {},
  proLabore: 0,
  pecasMes: null,
  impostoPct: 0,
  taxaRecebimentoPct: 0,
  acrescimoCanais: {},
};

/** Marketplaces com acréscimo próprio. Vale com ou sem integração. */
export const CANAIS_ACRESCIMO = [
  { chave: "mercado_livre", nome: "Mercado Livre" },
  { chave: "tiktok_shop", nome: "TikTok Shop" },
  { chave: "shopee", nome: "Shopee" },
] as const;

export type ChaveCanalAcrescimo = (typeof CANAIS_ACRESCIMO)[number]["chave"];

/**
 * Quanto dos custos da marca cada peça carrega: (fixos + pró-labore) ÷ peças
 * do mês. null quando há custo a dividir e falta o número de peças: dividir
 * por 1 jogava o aluguel inteiro numa peça só.
 *
 * `comSalario`: Produto sim; Serviço e Encomenda não, porque lá o salário já
 * entra pelo valor da hora.
 */
export function rateioDaMarca(c: CustosMarca, comSalario: boolean): number | null {
  const total = c.fixosMes + (comSalario ? c.proLabore : 0);
  if (total <= 0) return 0;
  if (!c.pecasMes || c.pecasMes < 1) return null;
  return total / c.pecasMes;
}

/** Preço no marketplace com o acréscimo do canal, arredondado em centavos. */
export function precoNoCanal(preco: number, acrescimoPct: number): number {
  if (!(preco > 0)) return 0;
  const pct = acrescimoPct > 0 ? acrescimoPct : 0;
  return Math.round(preco * (1 + pct / 100) * 100) / 100;
}

/** Média de peças por mês, pra sugerir no Financeiro: total vendido ÷ meses. */
export function mediaDePecas(totalVendido: number, meses: number): number | null {
  if (!(meses > 0) || !(totalVendido > 0)) return null;
  return Math.max(1, Math.round(totalVendido / meses));
}

/** Lê a linha do banco (números podem vir como texto do Postgres). */
export function custosDaLinha(
  linha: {
    fixos_mes?: number | string | null;
    fixos_detalhe?: unknown;
    pecas_mes?: number | null;
    imposto_pct?: number | string | null;
    taxa_recebimento_pct?: number | string | null;
    acrescimo_canais?: unknown;
  } | null,
  proLabore: number | null,
): CustosMarca {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : 0;
  };
  const objeto = (v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const detalhe: Record<string, string> = {};
  for (const [k, v] of Object.entries(objeto(linha?.fixos_detalhe))) {
    if (typeof v === "string" && v.trim()) detalhe[k] = v;
  }
  const acrescimo: Record<string, number> = {};
  for (const [k, v] of Object.entries(objeto(linha?.acrescimo_canais))) {
    if (n(v) > 0) acrescimo[k] = n(v);
  }
  return {
    fixosMes: n(linha?.fixos_mes),
    fixosDetalhe: detalhe,
    proLabore: n(proLabore),
    pecasMes: linha?.pecas_mes && linha.pecas_mes >= 1 ? linha.pecas_mes : null,
    impostoPct: n(linha?.imposto_pct),
    taxaRecebimentoPct: n(linha?.taxa_recebimento_pct),
    acrescimoCanais: acrescimo,
  };
}
