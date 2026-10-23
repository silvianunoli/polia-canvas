// Preço e lucro por canal (VND-07, Fase 5). Puro. Usa as taxas cadastradas
// em Vendas (ONE-128, lib/taxas.ts) com a mesma conta de taxaDaVenda, e o
// lucro das vendas com a mesma conta de lib/vendas.ts.
//
// Na Calculadora, o imposto é o que ela pôs na conta e vale igual em todo
// canal; o que muda de um canal pro outro é só a taxa.

import { taxaDaVenda, ROTULO_TAXA, type ChaveTaxa, type RegraTaxa } from "@/lib/taxas";
import { lucroDaVenda, type CanalVenda, type Venda } from "@/lib/vendas";

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Ordem da tabela: do recebimento mais barato pro mais caro, marketplaces no fim. */
export const ORDEM_CHAVES: ChaveTaxa[] = [
  "pix",
  "dinheiro",
  "debito",
  "credito",
  "credito_parcelado",
  "link",
  "shopee",
  "tiktok_shop",
];

/** O que fica de uma venda a esse preço no canal: preço - custo - imposto - taxa. */
export function lucroNoCanal(p: {
  preco: number;
  custo: number;
  impostosPct: number;
  regra: RegraTaxa | null | undefined;
}): number {
  return centavos(
    p.preco - p.custo - (p.preco * p.impostosPct) / 100 - taxaDaVenda(p.preco, p.regra),
  );
}

/**
 * Menor preço (em centavos) que deixa pelo menos `lucroAlvo` no canal. null
 * quando taxa + imposto chegam a 100%: nenhum preço resolve.
 */
export function precoParaLucrar(p: {
  lucroAlvo: number;
  custo: number;
  impostosPct: number;
  regra: RegraTaxa | null | undefined;
}): number | null {
  const pct = (p.regra?.percentual ?? 0) + p.impostosPct;
  if (pct >= 100) return null;
  const fixo = p.regra?.fixo ?? 0;
  let preco = Math.ceil(((p.custo + p.lucroAlvo + fixo) / (1 - pct / 100)) * 100) / 100;
  // Taxa e lucro andam em centavos arredondados: ajusta pra cima até chegar
  // no lucro e depois desce enquanto ainda chega, pra ser o menor preço.
  const alvo = centavos(p.lucroAlvo);
  const chega = (v: number) => lucroNoCanal({ ...p, preco: v }) >= alvo;
  for (let i = 0; i < 10 && !chega(preco); i++) preco = centavos(preco + 0.01);
  for (let i = 0; i < 10 && preco > 0 && chega(centavos(preco - 0.01)); i++) {
    preco = centavos(preco - 0.01);
  }
  return Math.max(preco, 0);
}

export interface LinhaCanal {
  chave: ChaveTaxa;
  rotulo: string;
  regra: RegraTaxa;
  lucro: number;
  precoParaMesmoLucro: number | null;
}

/** Uma linha por taxa cadastrada (inclusive as cadastradas como sem taxa). */
export function linhasPorCanal(p: {
  preco: number;
  custo: number;
  impostosPct: number;
  lucroBase: number;
  taxas: Partial<Record<ChaveTaxa, RegraTaxa>>;
}): LinhaCanal[] {
  return ORDEM_CHAVES.filter((c) => p.taxas[c]).map((chave) => {
    const regra = p.taxas[chave]!;
    return {
      chave,
      rotulo: ROTULO_TAXA[chave],
      regra,
      lucro: lucroNoCanal({ preco: p.preco, custo: p.custo, impostosPct: p.impostosPct, regra }),
      // Sem lucro na conta não há "o mesmo lucro" pra buscar (a tela já avisa o piso).
      precoParaMesmoLucro:
        p.lucroBase > 0
          ? precoParaLucrar({
              lucroAlvo: p.lucroBase,
              custo: p.custo,
              impostosPct: p.impostosPct,
              regra,
            })
          : null,
    };
  });
}

/**
 * Canal que mais derruba o lucro, se derrubar mais de 1 centavo. Compara em
 * centavos inteiros: em float, 3,23 < 3,24 - 0,01 dava verdadeiro e a frase
 * aparecia por diferença de arredondamento. Sem lucro na conta, não aponta.
 */
export function canalQueMaisPesa(
  linhas: readonly LinhaCanal[],
  lucroBase: number,
): LinhaCanal | null {
  if (!(lucroBase > 0)) return null;
  const pior = [...linhas].sort((a, b) => a.lucro - b.lucro)[0];
  return pior && Math.round(pior.lucro * 100) < Math.round(lucroBase * 100) - 1 ? pior : null;
}

/**
 * Lucro da conta da Calculadora recalculado no mesmo preço arredondado e com
 * a taxa em centavos, igual às linhas: assim um canal com a mesma taxa da conta
 * dá exatamente o mesmo lucro (antes ficava 1 centavo diferente em 1 de cada 4).
 */
export function lucroDaConta(p: {
  preco: number;
  custo: number;
  impostosPct: number;
  taxaPct: number;
}): number {
  return lucroNoCanal({
    preco: p.preco,
    custo: p.custo,
    impostosPct: p.impostosPct,
    regra: { percentual: p.taxaPct, fixo: 0 },
  });
}

export interface ResumoCanal {
  canal: CanalVenda;
  vendas: number;
  /** Total que as clientes pagaram (com frete, antes da taxa). */
  vendeu: number;
  taxa: number;
  /** Lucro das vendas com custo conhecido. */
  lucrou: number;
  /** Vendas que entraram no lucro; 0 = nenhuma tinha custo, lucro desconhecido. */
  comCusto: number;
  semCusto: number;
}

/** Tabela "Por canal" de Vendas. Canceladas não entram; a receber entram. */
export function resumoPorCanal(
  vendas: readonly (Venda & { canal: CanalVenda; total: number })[],
): ResumoCanal[] {
  const mapa = new Map<CanalVenda, ResumoCanal>();
  for (const v of vendas) {
    if (v.status === "cancelada") continue;
    const r = mapa.get(v.canal) ?? {
      canal: v.canal,
      vendas: 0,
      vendeu: 0,
      taxa: 0,
      lucrou: 0,
      comCusto: 0,
      semCusto: 0,
    };
    r.vendas += 1;
    r.vendeu += v.total;
    r.taxa += v.taxaCanal;
    const lucro = lucroDaVenda(v);
    if (lucro == null) r.semCusto += 1;
    else {
      r.lucrou += lucro;
      r.comCusto += 1;
    }
    mapa.set(v.canal, r);
  }
  return [...mapa.values()]
    .map((r) => ({
      ...r,
      vendeu: centavos(r.vendeu),
      taxa: centavos(r.taxa),
      lucrou: centavos(r.lucrou),
    }))
    .sort(
      (a, b) =>
        Number(b.comCusto > 0) - Number(a.comCusto > 0) ||
        b.lucrou - a.lucrou ||
        b.vendas - a.vendas,
    );
}
