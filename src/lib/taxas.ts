// Taxas de recebimento (ONE-128). Puro: a leitura e a escrita moram em
// components/vendas/taxasDados.ts. A tabela taxas_recebimento repete a lista de
// chaves num check (migration 20261023190000): chave nova aqui pede migration.
//
// Na venda manual quem cobra é a forma de recebimento (maquininha, link), não o
// Instagram. Shopee, TikTok Shop e Mercado Livre cobram pelo canal; ficam aqui pra a
// integração (VND-05) e o lucro por canal (VND-07) usarem a mesma regra.

export const FORMAS_RECEBIMENTO = [
  "pix",
  "dinheiro",
  "debito",
  "credito",
  "credito_parcelado",
  "link",
] as const;
export const MARKETPLACES_COM_TAXA = ["shopee", "tiktok_shop", "mercado_livre"] as const;

export type FormaRecebimento = (typeof FORMAS_RECEBIMENTO)[number];
export type ChaveTaxa = FormaRecebimento | (typeof MARKETPLACES_COM_TAXA)[number];

export const ROTULO_TAXA: Record<ChaveTaxa, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito à vista",
  credito_parcelado: "Crédito parcelado",
  link: "Link de pagamento",
  shopee: "Shopee",
  tiktok_shop: "TikTok Shop",
  mercado_livre: "Mercado Livre",
};

export interface RegraTaxa {
  /** Percentual sobre o total da venda, de 0 a 100. */
  percentual: number;
  /** Valor fixo cobrado por venda, em reais. */
  fixo: number;
}

/**
 * Taxa de uma venda: percentual do total mais o fixo, nunca maior que o total
 * (venda de R$ 1 com fixo de R$ 2 não pode virar recebimento negativo).
 * Conta em centavos inteiros e meio centavo pra cima, como o round(numeric, 2)
 * do Postgres: em float, R$ 50 a 3,19% + R$ 0,50 dava 2,09 em vez de 2,10.
 */
export function taxaDaVenda(total: number, regra: RegraTaxa | null | undefined): number {
  if (!regra || !(total > 0)) return 0;
  const totalCents = Math.round(total * 100);
  const pctCentesimos = Math.round(regra.percentual * 100);
  const fixoCents = Math.round(regra.fixo * 100);
  const taxaCents = Math.round((totalCents * pctCentesimos) / 10_000) + fixoCents;
  return Math.min(Math.max(taxaCents, 0), totalCents) / 100;
}

/**
 * O que o campo de taxa da venda faz quando muda a forma, os itens ou as
 * regras: `null` deixa o campo como está, um número escreve (0 limpa).
 * Só sobrescreve taxa que a própria Pólia One preencheu: a digitada por ela
 * fica, mesmo trocando pra uma forma sem taxa cadastrada (revisão de 23/10).
 */
export function decidirTaxa(p: {
  forma: string;
  regra: RegraTaxa | null | undefined;
  regrasCarregadas: boolean;
  digitadaPorEla: boolean;
  taxaEraAutomatica: boolean;
  total: number;
}): number | null {
  if (p.digitadaPorEla) return null;
  if (!p.forma) return p.taxaEraAutomatica ? 0 : null;
  if (!p.regrasCarregadas) return null;
  if (regraEstaVazia(p.regra)) return p.taxaEraAutomatica ? 0 : null;
  return taxaDaVenda(p.total, p.regra);
}

export function regraEstaVazia(regra: RegraTaxa | null | undefined): boolean {
  return !regra || (regra.percentual === 0 && regra.fixo === 0);
}

/** "3,99% + R$ 0,50", "R$ 2,00", "4,5%" ou "sem taxa". */
export function descreverRegra(regra: RegraTaxa | null | undefined): string {
  if (regraEstaVazia(regra)) return "sem taxa";
  const pct = regra!.percentual
    ? `${regra!.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
    : "";
  const fixo = regra!.fixo
    ? regra!.fixo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "";
  return [pct, fixo].filter(Boolean).join(" + ");
}

export type ErroRegra = "percentual_invalido" | "fixo_invalido";

// O banco guarda 2 casas (numeric(5,2)): 4,989 virava 4,99 sem aviso.
const ateDuasCasas = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

export function validarRegra(r: RegraTaxa): ErroRegra | null {
  if (
    !Number.isFinite(r.percentual) ||
    r.percentual < 0 ||
    r.percentual > 100 ||
    !ateDuasCasas(r.percentual)
  )
    return "percentual_invalido";
  if (!Number.isFinite(r.fixo) || r.fixo < 0 || r.fixo > 100_000 || !ateDuasCasas(r.fixo))
    return "fixo_invalido";
  return null;
}

/**
 * Texto digitado em pt-BR ("3,99", "3.99", "") vira número; vazio é 0, lixo é
 * NaN. "3," no meio da digitação vale 3, pra o campo não piscar como erro.
 */
export function lerNumero(texto: string): number {
  const t = texto.trim().replace(/\s/g, "");
  if (!t) return 0;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d*)?$/.test(normal) ? Number(normal) : Number.NaN;
}
