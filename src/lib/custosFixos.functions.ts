// Custos fixos do mês, campo a campo (09/10/2026, decisão da Sil). Antes a
// calculadora tinha um campo só ("aluguel, internet, ferramentas") e ela
// somava tudo de cabeça. Agora o total pode ser detalhado nos itens abaixo,
// e cada item tem a MESMA categoria de saída do Financeiro: assim o "puxar do
// Financeiro" da calculadora preenche item por item, sem tabela de tradução.
//
// Fora daqui, de propósito: insumo e embalagem (custo direto de cada peça,
// decisão de 07/10) e pró-labore (campo próprio na calculadora e linha
// própria na Projeção).

import { CATEGORIA_PRO_LABORE, pertenceAoMes } from "@/lib/resumoContador.functions";
import type { LancamentoResumo } from "@/lib/resumoContador.functions";
import { ehCategoriaInsumos } from "@/lib/projecao.functions";

export const ITENS_CUSTO_FIXO = [
  {
    chave: "espaco",
    categoria: "Espaço (aluguel)",
    dica: "Aluguel do ateliê ou a parte da casa usada pela marca, condomínio.",
  },
  {
    chave: "contas",
    categoria: "Luz, água e gás",
    dica: "A parte da conta que a produção consome.",
  },
  {
    chave: "internet",
    categoria: "Internet e telefone",
    dica: "Plano de internet, celular da marca.",
  },
  {
    chave: "ferramentas",
    categoria: "Ferramentas e assinaturas",
    dica: "Canva, loja online, domínio, app de gestão.",
  },
  {
    chave: "marketing",
    categoria: "Marketing",
    dica: "Anúncio e impulsionamento com valor certo todo mês.",
  },
  {
    chave: "contador",
    categoria: "Contador e imposto fixo",
    dica: "DAS do MEI, mensalidade do contador.",
  },
  {
    chave: "ajuda",
    categoria: "Ajuda fixa",
    dica: "Assistente ou freela pago por mês, não por peça.",
  },
  {
    chave: "taxas",
    categoria: "Taxas fixas",
    dica: "Tarifa da conta PJ, aluguel da maquininha.",
  },
  {
    chave: "equipamento",
    categoria: "Reserva de equipamento",
    dica: "Preço do equipamento dividido pelos meses de uso.",
  },
  {
    chave: "outros",
    categoria: "Outros",
    dica: "O que é pago todo mês e não coube acima.",
  },
] as const;

export type ChaveCustoFixo = (typeof ITENS_CUSTO_FIXO)[number]["chave"];

/** Prefixo das chaves no calculadora_breakdown.valores (ex.: "fixo_espaco"). */
export const PREFIXO_FIXO = "fixo_";

/** Categorias de saída que entram no Financeiro, na ordem dos itens (sem "Outros"). */
export const CATEGORIAS_CUSTO_FIXO: string[] = ITENS_CUSTO_FIXO.filter(
  (i) => i.chave !== "outros",
).map((i) => i.categoria);

function lerNumero(s: string | undefined): number {
  if (!s) return 0;
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function somarCustosFixos(detalhe: Partial<Record<ChaveCustoFixo, string>>): number {
  return ITENS_CUSTO_FIXO.reduce((acc, i) => acc + lerNumero(detalhe[i.chave]), 0);
}

function normalizar(c: string): string {
  return c.trim().toLocaleLowerCase("pt-BR");
}

const CHAVE_POR_CATEGORIA = new Map<string, ChaveCustoFixo>(
  ITENS_CUSTO_FIXO.map((i) => [normalizar(i.categoria), i.chave]),
);

/**
 * Saídas do mês somadas por item de custo fixo. Mesmo recorte de
 * custosFixosDoMes (projecao.functions.ts): sem insumo e sem pró-labore, então
 * a soma dos itens bate com o "Custos fixos do mês" da Projeção. Categoria
 * criada por ela ("+ nova categoria") ou sem categoria cai em "Outros".
 */
export function custosFixosPorItem(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): Record<ChaveCustoFixo, number> {
  const total = Object.fromEntries(ITENS_CUSTO_FIXO.map((i) => [i.chave, 0])) as Record<
    ChaveCustoFixo,
    number
  >;
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || !pertenceAoMes(l.data, mes, ano)) continue;
    if (l.categoria === CATEGORIA_PRO_LABORE || ehCategoriaInsumos(l.categoria)) continue;
    const chave = (l.categoria && CHAVE_POR_CATEGORIA.get(normalizar(l.categoria))) || "outros";
    total[chave] += Number(l.valor);
  }
  return total;
}
