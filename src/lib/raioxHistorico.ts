// QA-30 (08/10/2026): o raio-x de um mês passado usa a meta e os preços
// DAQUELE mês quando dá pra saber, e diz numa frase quando não dá.
//
// Partes puras (sem banco): quem busca os dados é raiox.functions.ts.
//
// Meta: vem de meta_do_mes_historico (migração 20261008190000). Meses antes
// do histórico existir não têm linha, então a leitura usa a meta de hoje.
//
// Produtos: historico_precos guarda só o preço de VENDA antigo e o dia em que
// ele foi trocado ({ preco, data }, mais novo primeiro, gravado por
// ModalProduto e Calculadora). Custo e taxas não têm histórico: só são do mês
// com certeza quando o produto não foi editado depois que o mês fechou.
import { hojeEmBrasilia } from "@/lib/data.functions";
import { intervaloDoMes } from "@/lib/leituraPaginada";
import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";

export const MESES_NOME = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export interface MesAno {
  ano: number;
  mes: number;
}

/** O mês pedido já fechou? (mês corrente ou futuro = não) */
export function mesJaPassou(alvo: MesAno, atual: MesAno): boolean {
  return alvo.ano < atual.ano || (alvo.ano === atual.ano && alvo.mes < atual.mes);
}

// ── Meta ────────────────────────────────────────────────────────────────────

export interface EscolhaMeta {
  valorAlvo: number | null;
  /** true = mês passado sem meta guardada, a leitura usa a de hoje */
  usaMetaDeHoje: boolean;
}

/**
 * Mês corrente: meta de hoje. Mês passado: a do histórico se existir; se não
 * (mês antes do histórico, ou tabela ainda não criada), a de hoje com aviso.
 */
export function escolherMetaDoRaioX(args: {
  mesPassado: boolean;
  metaDoHistorico: number | null;
  metaDeHoje: number | null;
}): EscolhaMeta {
  const { mesPassado, metaDoHistorico, metaDeHoje } = args;
  if (!mesPassado) return { valorAlvo: metaDeHoje, usaMetaDeHoje: false };
  if (metaDoHistorico != null && Number.isFinite(metaDoHistorico)) {
    return { valorAlvo: metaDoHistorico, usaMetaDeHoje: false };
  }
  if (metaDeHoje == null) return { valorAlvo: null, usaMetaDeHoje: false };
  return { valorAlvo: metaDeHoje, usaMetaDeHoje: true };
}

// ── Produtos ────────────────────────────────────────────────────────────────

export interface ProdutoDoBanco {
  nome: string;
  preco_venda: number;
  preco_custo: number | null;
  calculadora_breakdown: CalculadoraBreakdown | null;
  historico_precos: unknown;
  preco_atualizado_em: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProdutoParaRaioX {
  nome: string;
  preco_venda: number;
  preco_custo: number | null;
  calculadora_breakdown: CalculadoraBreakdown | null;
}

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

interface TrocaDePreco {
  preco: number;
  data: string; // dia em que esse preço deixou de valer
}

function trocasValidas(historico: unknown): TrocaDePreco[] {
  if (!Array.isArray(historico)) return [];
  const trocas: TrocaDePreco[] = [];
  for (const item of historico) {
    if (!item || typeof item !== "object") continue;
    const { preco, data } = item as { preco?: unknown; data?: unknown };
    const n = Number(preco);
    if (typeof data !== "string" || !DIA_ISO.test(data) || !Number.isFinite(n)) continue;
    trocas.push({ preco: n, data });
  }
  return trocas;
}

/** Dia de Brasília de um timestamp do banco; null se não der pra ler. */
function diaEmBrasilia(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return hojeEmBrasilia(d);
}

export type SituacaoDoProduto =
  /** não existia no mês: fica fora da leitura */
  | { existia: false }
  | {
      existia: true;
      produto: ProdutoParaRaioX;
      /** preço de venda é o do fim do mês */
      precoDoMes: boolean;
      /** custo e taxas são os do fim do mês (produto não editado depois) */
      custoDoMes: boolean;
    };

/**
 * Preço e custo que o produto tinha no fim do mês (dia anterior a
 * `fimExclusivo`, formato AAAA-MM-DD).
 *
 * Preço: a troca mais antiga feita a partir de `fimExclusivo` guarda o preço
 * que valia no fim do mês. Sem troca depois do mês, o preço de hoje já valia
 * no fim do mês, a não ser que preco_atualizado_em diga que mudou depois sem
 * deixar histórico (aí não dá pra saber).
 */
export function situacaoDoProdutoNoMes(p: ProdutoDoBanco, fimExclusivo: string): SituacaoDoProduto {
  const criadoEm = diaEmBrasilia(p.created_at);
  if (criadoEm && criadoEm >= fimExclusivo) return { existia: false };

  const editadoEm = diaEmBrasilia(p.updated_at);
  const custoDoMes = editadoEm != null && editadoEm < fimExclusivo;

  const trocaDepois = trocasValidas(p.historico_precos)
    .filter((t) => t.data >= fimExclusivo)
    .sort((a, b) => a.data.localeCompare(b.data))[0];

  let preco = Number(p.preco_venda);
  let precoDoMes: boolean;
  if (trocaDepois) {
    preco = trocaDepois.preco;
    precoDoMes = true;
  } else {
    const precoMudouEm = diaEmBrasilia(p.preco_atualizado_em);
    precoDoMes = custoDoMes || precoMudouEm == null || precoMudouEm < fimExclusivo;
  }

  return {
    existia: true,
    produto: {
      nome: p.nome,
      preco_venda: preco,
      preco_custo: p.preco_custo,
      calculadora_breakdown: p.calculadora_breakdown,
    },
    precoDoMes,
    custoDoMes,
  };
}

export interface ProdutosDoRaioX {
  produtos: ProdutoParaRaioX[];
  /** algum produto entrou com o preço de hoje por falta de histórico */
  usaPrecoDeHoje: boolean;
  /** algum produto entrou com custo/taxas de hoje (editado depois do mês) */
  usaCustoDeHoje: boolean;
}

/**
 * Mês corrente: produtos como estão hoje. Mês passado: preço do fim do mês
 * quando o histórico permite, sem os produtos criados depois do mês.
 */
export function produtosDoRaioX(
  produtos: readonly ProdutoDoBanco[],
  alvo: MesAno,
  mesPassado: boolean,
): ProdutosDoRaioX {
  if (!mesPassado) {
    return {
      produtos: produtos.map((p) => ({
        nome: p.nome,
        preco_venda: Number(p.preco_venda),
        preco_custo: p.preco_custo,
        calculadora_breakdown: p.calculadora_breakdown,
      })),
      usaPrecoDeHoje: false,
      usaCustoDeHoje: false,
    };
  }
  const { fimExclusivo } = intervaloDoMes(alvo.ano, alvo.mes);
  const lista: ProdutoParaRaioX[] = [];
  let usaPrecoDeHoje = false;
  let usaCustoDeHoje = false;
  for (const p of produtos) {
    const s = situacaoDoProdutoNoMes(p, fimExclusivo);
    if (!s.existia) continue;
    lista.push(s.produto);
    // Produto sem preço fica fora do ranking (produtosPorSobra), então não
    // conta pro aviso.
    if (s.produto.preco_venda <= 0) continue;
    if (!s.precoDoMes) usaPrecoDeHoje = true;
    if (!s.custoDoMes) usaCustoDeHoje = true;
  }
  return { produtos: lista, usaPrecoDeHoje, usaCustoDeHoje };
}

// ── Avisos (frase fixa, escrita pelo app, nunca pela IA) ────────────────────

export function avisosDoRaioX(args: {
  alvo: MesAno;
  usaMetaDeHoje: boolean;
  usaPrecoDeHoje: boolean;
  usaCustoDeHoje: boolean;
}): string[] {
  const nome = MESES_NOME[args.alvo.mes - 1] ?? `${args.alvo.mes}/${args.alvo.ano}`;
  const avisos: string[] = [];
  if (args.usaMetaDeHoje) {
    avisos.push(`A meta de ${nome} não ficou guardada; a leitura usa a meta de hoje.`);
  }
  if (args.usaPrecoDeHoje) {
    avisos.push(
      `O preço de ${nome} não ficou guardado em todos os produtos; onde faltou, a leitura usa o preço de hoje.`,
    );
  }
  if (args.usaCustoDeHoje) {
    avisos.push(
      `O custo dos produtos não fica guardado mês a mês; nos produtos editados depois de ${nome}, a leitura usa o custo de hoje.`,
    );
  }
  return avisos;
}
