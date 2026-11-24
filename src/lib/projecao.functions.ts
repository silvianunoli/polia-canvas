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

// A compra da máquina acontece uma vez e o preço já entra como reserva por mês
// (ONE-193). Contar a compra inteira no mês em que foi paga derrubava o lucro e
// o ponto de empate daquele mês. A mesma string está na RPC
// marcar_equipamento_comprado: renomear aqui exige migration.
export const CATEGORIA_EQUIPAMENTO = "Compra de equipamento";

export function ehCompraDeEquipamento(categoria: string | null | undefined): boolean {
  if (!categoria) return false;
  return (
    categoria.trim().toLocaleLowerCase("pt-BR") === CATEGORIA_EQUIPAMENTO.toLocaleLowerCase("pt-BR")
  );
}

function saidasDoMes(lancamentos: LancamentoResumo[], mes: number, ano: number) {
  return lancamentos.filter((l) => l.tipo === "saida" && pertenceAoMes(l.data, mes, ano));
}

// Custos fixos = saídas do mês menos pró-labore (tem linha própria), menos
// insumo (já está no custo de cada produto) e menos compra de equipamento.
export function custosFixosDoMes(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): number {
  return saidasDoMes(lancamentos, mes, ano)
    .filter(
      (l) =>
        l.categoria !== CATEGORIA_PRO_LABORE &&
        !ehCategoriaInsumos(l.categoria) &&
        !ehCompraDeEquipamento(l.categoria),
    )
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

export function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}

// ── Custos fixos de partida (revisão de usabilidade de 24/11/2026, ONE-241) ──
// Antes a Projeção somava só as saídas lançadas ATÉ HOJE no mês corrente: no
// dia 3, com só a internet paga, o empate saía em 4 vendas, e no dia 1 a tela
// dizia "Falta cadastrar os seus custos fixos" pra quem tinha lançado tudo no
// mês anterior. Agora parte do maior entre o mês fechado e o mês corrente: o
// mês fechado é o retrato completo, e o corrente ganha quando já passou dele.
export function custosFixosDePartida(
  lancamentos: LancamentoResumo[],
  mes: number,
  ano: number,
): {
  valor: number;
  origem: "mes-anterior" | "mes-atual";
  doMesAtual: number;
  doMesAnterior: number;
} {
  const ant = mesAnterior(mes, ano);
  const doMesAtual = custosFixosDoMes(lancamentos, mes, ano);
  const doMesAnterior = custosFixosDoMes(lancamentos, ant.mes, ant.ano);
  return doMesAnterior > doMesAtual
    ? { valor: doMesAnterior, origem: "mes-anterior", doMesAtual, doMesAnterior }
    : { valor: doMesAtual, origem: "mes-atual", doMesAtual, doMesAnterior };
}

// ── Reserva de equipamento (ONE-251) ──
// A compra da máquina fica fora dos custos fixos (ver CATEGORIA_EQUIPAMENTO),
// mas a parcela de cada mês (preço ÷ meses de uso, aba Equipamentos) é custo
// fixo de verdade: sem ela o empate saía mais baixo pra quem tem máquina. Se
// ela já lança a reserva no Financeiro, nessa categoria, essa saída já está
// nos custos fixos: entra só o que falta, pra não contar duas vezes.
export const CATEGORIA_RESERVA_EQUIPAMENTO = "Reserva de equipamento";

function ehReservaDeEquipamento(categoria: string | null | undefined): boolean {
  if (!categoria) return false;
  return (
    categoria.trim().toLocaleLowerCase("pt-BR") ===
    CATEGORIA_RESERVA_EQUIPAMENTO.toLocaleLowerCase("pt-BR")
  );
}

export function reservaForaDoFinanceiro(params: {
  lancamentos: LancamentoResumo[];
  mes: number;
  ano: number;
  reservaDoMes: number;
}): number {
  const lancada = saidasDoMes(params.lancamentos, params.mes, params.ano)
    .filter((l) => ehReservaDeEquipamento(l.categoria))
    .reduce((acc, l) => acc + Number(l.valor), 0);
  return Math.round(Math.max(0, params.reservaDoMes - lancada) * 100) / 100;
}

// ── Salário de partida (ONE-241) ──
// "Quanto você quer tirar por mês" é o salário DESEJADO. Antes o campo abria
// com o pró-labore já lançado no mês corrente, que pode ser só uma parte (R$
// 500 de um salário de R$ 3.000), e o "Salvar" gravava essa parte como o
// salário desejado. Ordem agora: o salvo na Projeção, o do Planejamento
// (Módulo 4), e só então o pró-labore do mês FECHADO, que é um mês inteiro.
// O lançado no mês corrente não entra mais aqui; a tela só mostra como fato.
export function salarioDePartida(params: {
  salvo: number | null;
  doPlanejamento: number | null;
  lancadoMesAnterior: number;
}): { valor: number | null; origem: "salvo" | "planejamento" | "mes-anterior" | null } {
  if (params.salvo != null && params.salvo > 0) return { valor: params.salvo, origem: "salvo" };
  if (params.doPlanejamento != null && params.doPlanejamento > 0) {
    return { valor: params.doPlanejamento, origem: "planejamento" };
  }
  if (params.lancadoMesAnterior > 0) {
    return { valor: params.lancadoMesAnterior, origem: "mes-anterior" };
  }
  return { valor: null, origem: null };
}

// ── O que já entrou no mês (ONE-241) ──
// Mesma conta da barra da Meta do mês em Metas e no Painel: a soma das
// entradas do mês no Financeiro.
export function entradasDoMes(lancamentos: LancamentoResumo[], mes: number, ano: number): number {
  return lancamentos
    .filter((l) => l.tipo === "entrada" && pertenceAoMes(l.data, mes, ano))
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

// ONE-122 (feedback de teste de 11/10/2026): um produto muito mais caro ou
// muito mais barato que os outros puxava a média e mudava a Projeção inteira.
// Regra dos quartis (Tukey): fica fora da curva o produto cujo preço ou custo
// direto passa 1,5 vez a distância entre o 1º e o 3º quartil. Sai das três
// médias juntas (ticket, custo, taxas), senão um produto caro deixava o preço
// na média e tirava só o custo, e a sobra saía maior do que é.
// Com menos de 4 produtos não há curva pra comparar, então ninguém sai. Com
// distância zero (vários produtos iguais), aquele lado não tira ninguém: um
// produto um pouco diferente de cinco iguais não é ponto fora da curva.
export const MINIMO_PRA_SEPARAR_FORA_DA_CURVA = 4;

function quartil(ordenados: number[], q: number): number {
  const pos = (ordenados.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  const prox = ordenados[base + 1] ?? ordenados[base];
  return ordenados[base] + resto * (prox - ordenados[base]);
}

function limitesDaCurva(valores: number[]): { min: number; max: number } | null {
  const ordenados = [...valores].sort((a, b) => a - b);
  const q1 = quartil(ordenados, 0.25);
  const q3 = quartil(ordenados, 0.75);
  const distancia = q3 - q1;
  if (distancia <= 0) return null;
  return { min: q1 - 1.5 * distancia, max: q3 + 1.5 * distancia };
}

export function separarForaDaCurva<T extends ProdutoResumo>(
  produtos: T[],
): { naMedia: T[]; foraDaCurva: T[] } {
  const validos = produtosValidos(produtos) as T[];
  if (validos.length < MINIMO_PRA_SEPARAR_FORA_DA_CURVA) {
    return { naMedia: validos, foraDaCurva: [] };
  }
  const custo = (p: T) => custoDiretoDoProduto(p.precoCusto, p.calculadora_breakdown);
  const limPreco = limitesDaCurva(validos.map((p) => p.precoVenda));
  const limCusto = limitesDaCurva(validos.map(custo));
  const fora = (v: number, lim: { min: number; max: number } | null) =>
    lim !== null && (v < lim.min || v > lim.max);
  const naMedia: T[] = [];
  const foraDaCurva: T[] = [];
  for (const p of validos) {
    (fora(p.precoVenda, limPreco) || fora(custo(p), limCusto) ? foraDaCurva : naMedia).push(p);
  }
  return { naMedia, foraDaCurva };
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

// ── Quanto FALTA no mês (ONE-241) ──
// Título, subtítulo e tutorial prometiam "quantas vendas faltam", mas a tela
// mostrava o total do mês: no dia 24, com 40 de 62 vendas feitas, seguia "62".
// Agora desconta o que já entrou.
// - Empatar e salário (contribuição): cada real que entrou já deixou
//   sobra/ticket de lucro, então faltam ceil(alvo/sobra - entrou/ticket).
// - Meta (faturamento): faltam (meta - entrou), dividido pelo preço.
// A folga de 1e-9 é a mesma de vendasParaFaturar (erro de ponto flutuante).
export interface FaltaNoMes {
  vendas: number;
  faturamento: number;
}

export function montarFaltaNoMes(params: {
  custosFixos: number;
  proLaboreDesejado: number;
  metaAlvo: number | null;
  ticketMedio: number;
  sobra: number;
  jaEntrou: number;
}): { empatar: FaltaNoMes; sePagar: FaltaNoMes; meta: FaltaNoMes | null } | null {
  const { custosFixos, proLaboreDesejado, metaAlvo, ticketMedio: ticket, sobra } = params;
  if (sobra <= 0 || !(ticket > 0)) return null;
  const entrou = Math.max(0, params.jaEntrou);

  const contribuicao = (alvo: number): FaltaNoMes => {
    const vendas = Math.max(0, Math.ceil(alvo / sobra - entrou / ticket - 1e-9));
    return { vendas, faturamento: vendas * ticket };
  };
  const faturar = (alvo: number): FaltaNoMes => {
    const falta = Math.max(0, alvo - entrou);
    return { vendas: vendasParaFaturar(falta, ticket) ?? 0, faturamento: falta };
  };

  return {
    empatar: contribuicao(custosFixos),
    sePagar: contribuicao(custosFixos + proLaboreDesejado),
    meta: metaAlvo != null ? faturar(metaAlvo) : null,
  };
}
