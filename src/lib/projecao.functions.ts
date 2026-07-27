// Domínio de "Projeção e cenários" (Projete). Puro — sem UI, sem Supabase.
// Responde "quantas vendas e quanto de faturamento pra empatar, se pagar e
// bater a meta", a partir do que a Pólia já tem (Financeiro, Produtos, Meta
// do mês). Reaproveita precificacao.functions.ts (mesma "sobra") e
// CATEGORIA_PRO_LABORE de resumoContador.functions.ts (mesma categoria).

import { calcularQuantoSobra, taxasDoBreakdown } from "@/lib/precificacao.functions";
import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";
import { CATEGORIA_PRO_LABORE, pertenceAoMes } from "@/lib/resumoContador.functions";
import type { LancamentoResumo } from "@/lib/resumoContador.functions";

export function custosFixosDoMes(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): number {
  return lancamentos
    .filter((l) => pertenceAoMes(l.data, mes, ano))
    .filter((l) => l.tipo === "saida" && l.categoria !== CATEGORIA_PRO_LABORE)
    .reduce((acc, l) => acc + Number(l.valor), 0);
}

export function proLaboreJaLancado(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): number {
  return lancamentos
    .filter((l) => pertenceAoMes(l.data, mes, ano))
    .filter((l) => l.tipo === "saida" && l.categoria === CATEGORIA_PRO_LABORE)
    .reduce((acc, l) => acc + Number(l.valor), 0);
}

export interface ProdutoResumo {
  precoVenda: number;
  precoCusto: number | null;
  calculadora_breakdown: CalculadoraBreakdown | null;
}

// Média simples, não ponderada — não existe dado de volume de venda por
// produto pra ponderar (KISS/YAGNI, registrado no PRD como decisão consciente).
function produtosValidos(produtos: ProdutoResumo[]): ProdutoResumo[] {
  return produtos.filter((p) => p.precoVenda > 0);
}

export function ticketMedio(produtos: ProdutoResumo[]): number {
  const validos = produtosValidos(produtos);
  if (validos.length === 0) return 0;
  return validos.reduce((acc, p) => acc + p.precoVenda, 0) / validos.length;
}

export function custoMedio(produtos: ProdutoResumo[]): number {
  const validos = produtosValidos(produtos);
  if (validos.length === 0) return 0;
  return validos.reduce((acc, p) => acc + (p.precoCusto ?? 0), 0) / validos.length;
}

export function mediaTaxas(produtos: ProdutoResumo[]): {
  taxaVendaPct: number;
  impostosPct: number;
} {
  const validos = produtosValidos(produtos);
  if (validos.length === 0) return { taxaVendaPct: 0, impostosPct: 0 };
  const somas = validos.reduce(
    (acc, p) => {
      const t = taxasDoBreakdown(p.calculadora_breakdown);
      return {
        taxaVendaPct: acc.taxaVendaPct + t.taxaVendaPct,
        impostosPct: acc.impostosPct + t.impostosPct,
      };
    },
    { taxaVendaPct: 0, impostosPct: 0 },
  );
  return {
    taxaVendaPct: somas.taxaVendaPct / validos.length,
    impostosPct: somas.impostosPct / validos.length,
  };
}

export function sobraPorVenda(params: {
  ticketMedio: number;
  custoMedio: number;
  taxaVendaPct: number;
  impostosPct: number;
}): number {
  return calcularQuantoSobra({
    precoVenda: params.ticketMedio,
    precoCusto: params.custoMedio,
    taxaVendaPct: params.taxaVendaPct,
    impostosPct: params.impostosPct,
  });
}

// null sinaliza "sobra <= 0" — não existe número de vendas que se pague.
export function vendasParaAlvo(alvo: number, sobra: number): number | null {
  if (sobra <= 0) return null;
  if (alvo <= 0) return 0;
  return Math.ceil(alvo / sobra);
}

export interface ItemProjecao {
  vendas: number;
  faturamento: number;
}

export interface Projecao {
  empatar: ItemProjecao;
  sePagar: ItemProjecao;
  meta: ItemProjecao | null;
}

// Retorna null só quando a sobra por venda é <= 0 (erro de negócio, tratado
// à parte na UI). Meta vem null quando não há "Meta do mês" cadastrada — não
// é erro, só omite a linha.
export function montarProjecao(params: {
  custosFixos: number;
  proLaboreDesejado: number;
  metaAlvo: number | null;
  ticketMedio: number;
  sobra: number;
}): Projecao | null {
  const { custosFixos, proLaboreDesejado, metaAlvo, ticketMedio: ticket, sobra } = params;
  if (sobra <= 0) return null;

  const item = (alvo: number): ItemProjecao => {
    const vendas = vendasParaAlvo(alvo, sobra) ?? 0;
    return { vendas, faturamento: vendas * ticket };
  };

  return {
    empatar: item(custosFixos),
    sePagar: item(custosFixos + proLaboreDesejado),
    meta: metaAlvo != null ? item(metaAlvo) : null,
  };
}
