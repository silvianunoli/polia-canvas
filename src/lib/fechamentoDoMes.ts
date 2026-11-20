// Fechamento do mês (ONE-207 Fase 3): a conciliação da planilha que a Sil
// trouxe ("Modelo de conciliação de contas"), dentro do Financeiro.
//
//   - Entradas do mês por forma de recebimento (Pix, dinheiro, débito...), pra
//     bater com o extrato do banco e o relatório da maquininha.
//   - O mesmo, dia a dia (a aba "Contas a receber" da planilha é por dia e forma).
//   - Taxas e descontos no recebimento, juros pagos e descontos obtidos nas
//     contas a pagar: a diferença entre o valor original e o que entrou ou saiu.
//   - As linhas da planilha pra baixar, no formato das duas abas dela.
//
// Puro: sem React nem Supabase. Quem lê o banco é components/financeiro/
// fechamentoDados.ts; a junção é pelo lancamento_id que cada conta e venda guarda.

import { FORMAS_RECEBIMENTO, ROTULO_TAXA, type FormaRecebimento } from "@/lib/taxas";

export type ChaveForma = FormaRecebimento | "nao_informada";

export const ROTULO_FORMA: Record<ChaveForma, string> = {
  ...ROTULO_TAXA,
  nao_informada: "Não informada",
} as Record<ChaveForma, string>;

export const ORDEM_FORMAS: ChaveForma[] = [...FORMAS_RECEBIMENTO, "nao_informada"];

export interface LancamentoDoFechamento {
  id: string;
  tipo: string;
  valor: number;
  data: string; // AAAA-MM-DD
  descricao: string | null;
  categoria: string | null;
  forma?: string | null;
}

/** Conta a pagar paga, com o lançamento de saída que ela criou. */
export interface ContaPagaDoMes {
  lancamentoId: string | null;
  fornecedor: string | null;
  documento: string | null;
  parcela: number | null;
  parcelas: number | null;
  valor: number;
  /** Null em conta paga antes do ONE-207 = pagou o original. */
  valorPago: number | null;
}

/** Conta a receber recebida, com o lançamento de entrada que ela criou. */
export interface ContaRecebidaDoMes {
  lancamentoId: string | null;
  cliente: string | null;
  documento: string | null;
  parcela: number | null;
  parcelas: number | null;
  valor: number;
  valorRecebido: number | null;
}

/** Venda recebida, com o lançamento de entrada que ela criou. */
export interface VendaRecebidaDoMes {
  lancamentoId: string | null;
  clienteNome: string | null;
  total: number;
  taxaCanal: number;
  custoEnvio: number;
}

export interface ExtrasDoFechamento {
  contasPagas: readonly ContaPagaDoMes[];
  contasRecebidas: readonly ContaRecebidaDoMes[];
  vendas: readonly VendaRecebidaDoMes[];
}

export interface DiaDoFechamento {
  data: string;
  porForma: Partial<Record<ChaveForma, number>>;
  entradas: number;
  saidas: number;
}

export interface FechamentoDoMes {
  porForma: { chave: ChaveForma; total: number; quantidade: number }[];
  entradas: number;
  saidas: number;
  porDia: DiaDoFechamento[];
  /** Taxa de canal e frete das vendas + o que caiu a menos nas contas recebidas. */
  taxasNoRecebimento: number;
  /** O que saiu a mais que o original nas contas pagas. */
  jurosPagos: number;
  /** O que saiu a menos que o original nas contas pagas. */
  descontosObtidos: number;
}

const centavos = (v: number) => Math.round(v * 100) / 100;
const soma = (a: number, b: number) => centavos(a + b);

export function chaveDaForma(forma: string | null | undefined): ChaveForma {
  return (FORMAS_RECEBIMENTO as readonly string[]).includes(forma ?? "")
    ? (forma as FormaRecebimento)
    : "nao_informada";
}

/** "2026-11" → primeiro e último dia ("2026-11-01", "2026-11-30"). */
export function limitesDoMesISO(anoMes: string): { de: string; ate: string } {
  const [a, m] = anoMes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { de: `${a}-${mm}-01`, ate: `${a}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

export function lancamentosDoMes<T extends LancamentoDoFechamento>(
  lancamentos: readonly T[],
  anoMes: string,
): T[] {
  return lancamentos.filter((l) => l.data.slice(0, 7) === anoMes);
}

export function fechamentoDoMes(
  lancamentos: readonly LancamentoDoFechamento[],
  anoMes: string,
  extras: ExtrasDoFechamento,
): FechamentoDoMes {
  const doMes = lancamentosDoMes(lancamentos, anoMes);
  const ids = new Set(doMes.map((l) => l.id));

  const porForma = new Map<ChaveForma, { total: number; quantidade: number }>();
  const porDia = new Map<string, DiaDoFechamento>();
  let entradas = 0;
  let saidas = 0;

  for (const l of doMes) {
    const valor = Number(l.valor);
    const dia = porDia.get(l.data) ?? { data: l.data, porForma: {}, entradas: 0, saidas: 0 };
    if (l.tipo === "entrada") {
      const chave = chaveDaForma(l.forma);
      const atual = porForma.get(chave) ?? { total: 0, quantidade: 0 };
      porForma.set(chave, { total: soma(atual.total, valor), quantidade: atual.quantidade + 1 });
      dia.porForma[chave] = soma(dia.porForma[chave] ?? 0, valor);
      dia.entradas = soma(dia.entradas, valor);
      entradas = soma(entradas, valor);
    } else if (l.tipo === "saida") {
      dia.saidas = soma(dia.saidas, valor);
      saidas = soma(saidas, valor);
    }
    porDia.set(l.data, dia);
  }

  // Só conta a diferença de quem virou lançamento neste mês.
  const doMesmoMes = (id: string | null) => !!id && ids.has(id);

  let taxasNoRecebimento = 0;
  for (const v of extras.vendas) {
    if (!doMesmoMes(v.lancamentoId)) continue;
    taxasNoRecebimento = soma(taxasNoRecebimento, centavos(v.taxaCanal) + centavos(v.custoEnvio));
  }
  for (const c of extras.contasRecebidas) {
    if (!doMesmoMes(c.lancamentoId) || c.valorRecebido === null) continue;
    const dif = centavos(c.valor - c.valorRecebido);
    if (dif > 0) taxasNoRecebimento = soma(taxasNoRecebimento, dif);
  }

  let jurosPagos = 0;
  let descontosObtidos = 0;
  for (const c of extras.contasPagas) {
    if (!doMesmoMes(c.lancamentoId) || c.valorPago === null) continue;
    const dif = centavos(c.valorPago - c.valor);
    if (dif > 0) jurosPagos = soma(jurosPagos, dif);
    else if (dif < 0) descontosObtidos = soma(descontosObtidos, -dif);
  }

  return {
    porForma: ORDEM_FORMAS.filter((f) => porForma.has(f)).map((chave) => ({
      chave,
      ...porForma.get(chave)!,
    })),
    entradas,
    saidas,
    porDia: [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data)),
    taxasNoRecebimento,
    jurosPagos,
    descontosObtidos,
  };
}

// ── Planilha ────────────────────────────────────────────────────────────────

export const CABECALHO_PLANILHA = [
  "TIPO",
  "DATA",
  "CLIENTE OU FORNECEDOR",
  "DOCUMENTO / PARCELA",
  "FORMA",
  "DESCRIÇÃO",
  "CATEGORIA",
  "VALOR ORIGINAL",
  "VALOR PAGO OU RECEBIDO",
];

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const reais = (v: number) => centavos(v).toFixed(2).replace(".", ",");

function documentoEParcela(doc: string | null, parcela: number | null, parcelas: number | null) {
  const p = parcela && parcelas ? `parcela ${parcela}/${parcelas}` : "";
  return [doc ?? "", p].filter(Boolean).join(" · ");
}

/**
 * Uma linha por lançamento do mês, no formato das duas abas da planilha da
 * Sil (contas a pagar e a receber) juntas, entradas primeiro, por data.
 * Valor original vem da conta ou da venda; lançamento avulso repete o valor.
 */
export function linhasDaPlanilha(
  lancamentos: readonly LancamentoDoFechamento[],
  anoMes: string,
  extras: ExtrasDoFechamento,
): string[][] {
  const pagas = new Map(extras.contasPagas.map((c) => [c.lancamentoId, c]));
  const recebidas = new Map(extras.contasRecebidas.map((c) => [c.lancamentoId, c]));
  const vendas = new Map(extras.vendas.map((v) => [v.lancamentoId, v]));

  return lancamentosDoMes(lancamentos, anoMes)
    .filter((l) => l.tipo === "entrada" || l.tipo === "saida")
    .sort(
      (a, b) =>
        (a.tipo === b.tipo ? 0 : a.tipo === "entrada" ? -1 : 1) ||
        a.data.localeCompare(b.data) ||
        a.id.localeCompare(b.id),
    )
    .map((l) => {
      const valor = Number(l.valor);
      let quem = "";
      let documento = "";
      let original = valor;
      if (l.tipo === "saida") {
        const c = pagas.get(l.id);
        if (c) {
          quem = c.fornecedor ?? "";
          documento = documentoEParcela(c.documento, c.parcela, c.parcelas);
          original = c.valor;
        }
      } else {
        const c = recebidas.get(l.id);
        const v = vendas.get(l.id);
        if (c) {
          quem = c.cliente ?? "";
          documento = documentoEParcela(c.documento, c.parcela, c.parcelas);
          original = c.valor;
        } else if (v) {
          quem = v.clienteNome ?? "";
          original = v.total;
        }
      }
      return [
        l.tipo === "entrada" ? "Entrada" : "Saída",
        dataBr(l.data),
        quem,
        documento,
        l.tipo === "entrada" ? ROTULO_FORMA[chaveDaForma(l.forma)] : "",
        l.descricao ?? "",
        l.categoria ?? "",
        reais(original),
        reais(valor),
      ];
    });
}
