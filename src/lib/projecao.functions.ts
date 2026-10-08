// Domínio de "Projeção e cenários" (Projete). Puro — sem UI, sem Supabase.
// Responde "quantas vendas e quanto de faturamento pra empatar, se pagar e
// bater a meta", a partir do que a Pólia já tem (Financeiro, Produtos, Meta
// do mês). Reaproveita precificacao.functions.ts (mesma "sobra") e
// CATEGORIA_PRO_LABORE de resumoContador.functions.ts (mesma categoria).

import {
  calcularQuantoSobra,
  custoDiretoDoProduto,
  taxasDoBreakdown,
} from "@/lib/precificacao.functions";
import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";
import { CATEGORIA_PRO_LABORE, pertenceAoMes } from "@/lib/resumoContador.functions";
import type { LancamentoResumo } from "@/lib/resumoContador.functions";

// ── Leitura dos campos de reais da Projeção (QA-29) ──
// Antes era Number(texto.replace(",", ".")): "1.500" (mil e quinhentos, do
// jeito que se escreve no Brasil) virava 1,5 sem aviso nenhum, e "1.500,50"
// virava NaN. Regras, nesta ordem:
// - vazio (ou só "R$") = null: o campo ainda não tem valor;
// - com ponto E vírgula, o separador que vem por último é o decimal
//   ("1.500,50" e "1,500.50" = 1500,5);
// - só vírgula: uma vírgula é decimal ("1500,5"); mais de uma é ambíguo = NaN;
// - só ponto: grupos de 3 depois de um primeiro grupo que não começa com 0 são
//   milhar ("1.500", "12.345.678"); um ponto só, fora disso, é decimal
//   ("898.57", "0.500", que é como o próprio campo mostrava o valor salvo);
// - negativo ou qualquer outra coisa = NaN (a tela mostra o erro do campo).
export function lerValorReais(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, "").replace(/\s/g, ""); // \s já cobre o espaço não separável (U+00A0)
  if (limpo === "") return null;
  if (!/^[\d.,]+$/.test(limpo) || !/\d/.test(limpo)) return NaN;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado: string;
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const decimal = ultimaVirgula > ultimoPonto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    const [inteiro, frac, ...resto] = limpo.split(decimal);
    if (resto.length > 0 || frac.includes(milhar)) return NaN;
    if (!/^\d{1,3}([.,]\d{3})*$/.test(inteiro)) return NaN;
    normalizado = `${inteiro.split(milhar).join("")}.${frac}`;
  } else if (ultimaVirgula >= 0) {
    if (limpo.indexOf(",") !== ultimaVirgula) return NaN;
    normalizado = limpo.replace(",", ".");
  } else if (ultimoPonto >= 0) {
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(limpo)) {
      normalizado = limpo.split(".").join("");
    } else if (limpo.indexOf(".") === ultimoPonto) {
      normalizado = limpo;
    } else {
      return NaN;
    }
  } else {
    normalizado = limpo;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

// Valor que entra na conta a partir do texto do campo:
// - campo nunca editado (texto null) = valor real (base);
// - campo apagado = vazio (0 nos custos, null na meta);
// - texto inválido = valor real, pra a tela não virar "NaN vendas" enquanto o
//   erro do campo já avisa o que corrigir.
export function valorDoCampo<V extends number | null>(
  texto: string | null,
  base: number | V,
  vazio: V,
): number | V {
  if (texto == null) return base;
  const n = lerValorReais(texto);
  if (n == null) return vazio;
  return Number.isNaN(n) ? base : n;
}

// Valor de partida de um campo editável: 2 casas e vírgula decimal, sem ponto
// de milhar. Assim o que o campo mostra relê igual em lerValorReais.
export function paraCampoReais(v: number): string {
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

// O que o "Salvar salário e meta" faz com a Meta do mês. Antes, sem uma Meta
// do mês já existente, o botão só salvava o salário e avisava "Salário e meta
// salvos." (QA-29, o "salvo que não salvou"). Meta zerada ou apagada não é
// gravada: a meta que já existe continua como está.
export function acaoDaMeta(params: {
  metaId: string | null;
  editada: boolean;
  valor: number | null;
}): "atualizar" | "criar" | "manter" {
  if (!params.editada || params.valor == null || !(params.valor > 0)) return "manter";
  return params.metaId ? "atualizar" : "criar";
}

// ── Insumo fora dos custos fixos (decisão da Sil, 07/10/2026) ──
// Compra de insumo/matéria-prima já entra no custo de CADA produto (é o
// "custo médio" que sai do ticket pra dar a sobra por venda). Somar essa
// compra também nos custos fixos contava o mesmo dinheiro duas vezes e
// inflava o ponto de empate (caderno a R$ 49 com sobra de R$ 19,60, R$ 600 de
// fixos e R$ 1.000 de insumo: 82 vendas em vez de 31).
//
// Mesmo texto do chip padrão de saída do ModalLancamento
// (components/financeiro/ModalLancamento.tsx, CATEGORIAS_SAIDA). Se o chip
// for renomeado lá, renomeie aqui. Limitação conhecida: a categoria é texto
// livre ("+ nova categoria"), então insumo lançado com outro nome ("Papel",
// "Insumos") continua contando como custo fixo.
export const CATEGORIA_INSUMOS = "Insumos / estoque";

export function ehCategoriaInsumos(categoria: string | null | undefined): boolean {
  if (!categoria) return false;
  return (
    categoria.trim().toLocaleLowerCase("pt-BR") === CATEGORIA_INSUMOS.toLocaleLowerCase("pt-BR")
  );
}

function saidasDoMes(lancamentos: LancamentoResumo[], mes: number, ano: number) {
  return lancamentos.filter((l) => l.tipo === "saida" && pertenceAoMes(l.data, mes, ano));
}

// Custos fixos = saídas do mês menos pró-labore (tem linha própria) e menos
// insumo (já está no custo de cada produto).
export function custosFixosDoMes(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): number {
  return saidasDoMes(lancamentos, mes, ano)
    .filter((l) => l.categoria !== CATEGORIA_PRO_LABORE && !ehCategoriaInsumos(l.categoria))
    .reduce((acc, l) => acc + Number(l.valor), 0);
}

// Quanto de insumo do mês ficou fora dos custos fixos (pra tela explicar).
export function insumosDoMes(lancamentos: LancamentoResumo[], mes: number, ano: number): number {
  return saidasDoMes(lancamentos, mes, ano)
    .filter((l) => ehCategoriaInsumos(l.categoria))
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

// Custo direto: os custos fixos entram à parte (custosFixosDoMes), então o
// rateio que a calculadora embute no preco_custo sai daqui (ONE-95).
export function custoMedio(produtos: ProdutoResumo[]): number {
  const validos = produtosValidos(produtos);
  if (validos.length === 0) return 0;
  return (
    validos.reduce(
      (acc, p) => acc + custoDiretoDoProduto(p.precoCusto, p.calculadora_breakdown),
      0,
    ) / validos.length
  );
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

// Vendas pra ENTRAR um valor de faturamento (a Meta do mês). Divide pelo
// PREÇO, não pela sobra: Painel e Financeiro medem a meta pelo que entrou
// (barra = entradas / meta). Fonte única da Projeção e da Calculadora desde
// 07/10/2026; antes a Calculadora dividia pela sobra e as duas telas davam
// números diferentes pro mesmo caso (caderno a R$ 49, sobra de R$ 19,60, meta
// de R$ 3.000: Calculadora 154, Projeção 62).
// null = sem preço, não existe número de vendas.
export function vendasParaFaturar(alvo: number, preco: number): number | null {
  if (!(preco > 0)) return null;
  if (!(alvo > 0)) return 0;
  // A folga de 1e-9 evita que erro de ponto flutuante (299 / 29,9 =
  // 10,000000000000002) vire uma venda a mais.
  return Math.ceil(alvo / preco - 1e-9);
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

  // Empatar e se pagar são metas de CONTRIBUIÇÃO (cobrir custo/pró-labore) —
  // dividem pela sobra por venda.
  const item = (alvo: number): ItemProjecao => {
    const vendas = vendasParaAlvo(alvo, sobra) ?? 0;
    return { vendas, faturamento: vendas * ticket };
  };

  // Meta do mês é meta de FATURAMENTO, não de lucro — mesma leitura do Painel
  // e do Financeiro (receita ÷ meta). Divide pelo ticket médio, não pela
  // sobra (vendasParaFaturar, a mesma conta da Calculadora), e o faturamento
  // da linha É a própria meta (não vendas × ticket).
  const itemMeta = (alvo: number): ItemProjecao => ({
    vendas: vendasParaFaturar(alvo, ticket) ?? 0,
    faturamento: alvo,
  });

  return {
    empatar: item(custosFixos),
    sePagar: item(custosFixos + proLaboreDesejado),
    meta: metaAlvo != null ? itemMeta(metaAlvo) : null,
  };
}
