// Contas a pagar (ONE-127). Regras sem React nem Supabase: a leitura e a
// escrita moram em components/financeiro/contasPagarDados.ts. Pagar e desfazer
// são RPCs (pagar_conta, desfazer_pagamento) porque mexem em lancamentos e
// criam a conta do mês seguinte numa transação só.

import { formatarReais } from "@/lib/formatarReais";
import type { FormaLancamento } from "@/lib/formas";

export type RecorrenciaConta = "nenhuma" | "mensal";
export type StatusConta = "a_pagar" | "paga";

export interface ContaPagar {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string; // AAAA-MM-DD
  categoria: string | null;
  recorrencia: RecorrenciaConta;
  /** Dia escolhido na primeira conta da repetição (o banco guarda). */
  diaRecorrencia: number | null;
  status: StatusConta;
  pagoEm: string | null;
  /** Quem recebe. Desde ONE-207 (planilha de conciliação). */
  fornecedor: string | null;
  /** NF-e, boleto, ID da transação do Pix. */
  documento: string | null;
  /** Como ela costuma pagar essa conta; na paga, como pagou. */
  forma: FormaLancamento | null;
  /** O que saiu de fato. Null em conta paga antes do ONE-207 = pagou o valor original. */
  valorPago: number | null;
  /** "2" de "2 de 3". Null quando a conta não é parcelada. */
  parcela: number | null;
  parcelas: number | null;
}

/** Onde a conta está em relação a hoje. "semana" = vence nos próximos 7 dias. */
export type SituacaoConta = "atrasada" | "hoje" | "semana" | "depois";

const DIAS_DA_SEMANA = 7;

function diasEntre(deISO: string, ateISO: string): number {
  const [a1, m1, d1] = deISO.split("-").map(Number);
  const [a2, m2, d2] = ateISO.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

export function situacaoDaConta(vencimento: string, hoje: string): SituacaoConta {
  const faltam = diasEntre(hoje, vencimento);
  if (faltam < 0) return "atrasada";
  if (faltam === 0) return "hoje";
  if (faltam <= DIAS_DA_SEMANA) return "semana";
  return "depois";
}

/** Texto curto do vencimento pra linha da lista. */
export function rotuloDoVencimento(vencimento: string, hoje: string): string {
  const faltam = diasEntre(hoje, vencimento);
  if (faltam < -1) return `venceu há ${-faltam} dias`;
  if (faltam === -1) return "venceu ontem";
  if (faltam === 0) return "vence hoje";
  if (faltam === 1) return "vence amanhã";
  if (faltam <= DIAS_DA_SEMANA) return `vence em ${faltam} dias`;
  return `vence dia ${dataCurta(vencimento, hoje)}`;
}

/** "05/11", ou "05/01/2027" quando o ano não é o de hoje. */
export function dataCurta(iso: string, hoje: string): string {
  const [a, m, d] = iso.split("-");
  return a === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

/**
 * Vencimento do mês seguinte, mantendo o dia escolhido na primeira conta
 * (31/01 → 28/02 → 31/03). Quem cria a conta seguinte é o banco
 * (contas_pagar_proximo_vencimento, migration 20261023180000); esta cópia
 * escreve no aviso de "Paguei" a data que o banco vai usar, e o teste fixa a
 * regra. Mudar uma pede mudar a outra.
 */
export function proximoVencimento(vencimento: string, diaOriginal?: number): string {
  const [ano, mes, dia] = vencimento.split("-").map(Number);
  const proxAno = mes === 12 ? ano + 1 : ano;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const ultimoDia = new Date(Date.UTC(proxAno, proxMes, 0)).getUTCDate();
  const d = Math.min(diaOriginal ?? dia, ultimoDia);
  return `${proxAno}-${String(proxMes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface ResumoContas {
  atrasadas: { quantidade: number; total: number };
  /** Vence hoje ou nos próximos 7 dias. */
  semana: { quantidade: number; total: number };
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export function resumoContas(contas: ContaPagar[], hoje: string): ResumoContas {
  const r: ResumoContas = {
    atrasadas: { quantidade: 0, total: 0 },
    semana: { quantidade: 0, total: 0 },
  };
  for (const c of contas) {
    if (c.status !== "a_pagar") continue;
    const s = situacaoDaConta(c.vencimento, hoje);
    const alvo = s === "atrasada" ? r.atrasadas : s === "hoje" || s === "semana" ? r.semana : null;
    if (!alvo) continue;
    alvo.quantidade += 1;
    alvo.total = centavos(alvo.total + c.valor);
  }
  return r;
}

/** "2 atrasadas (R$ 100,00) · 3 vencem nos próximos 7 dias (R$ 300,00)". Vazio sem nada no prazo. */
export function frasePrazo(r: ResumoContas): string {
  const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });
  const partes: string[] = [];
  if (r.atrasadas.quantidade > 0)
    partes.push(
      `${r.atrasadas.quantidade} ${r.atrasadas.quantidade === 1 ? "atrasada" : "atrasadas"} (${fmt(r.atrasadas.total)})`,
    );
  if (r.semana.quantidade > 0)
    partes.push(
      `${r.semana.quantidade} ${r.semana.quantidade === 1 ? "vence" : "vencem"} nos próximos 7 dias (${fmt(r.semana.total)})`,
    );
  return partes.join(" · ");
}

/** A pagar primeiro, por vencimento; dentro do mesmo dia, a maior antes. */
export function ordenarContas(contas: ContaPagar[]): ContaPagar[] {
  return [...contas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor);
}

export type ErroConta =
  | "sem_descricao"
  | "sem_valor"
  | "sem_vencimento"
  | "valor_alto"
  | "parcelas_fora"
  | "parcela_sem_valor";

export const MAX_PARCELAS = 60;

export function validarConta(c: {
  descricao: string;
  valor: number;
  vencimento: string;
  /** Só na criação de conta parcelada; o valor é o total. */
  parcelas?: number;
}): ErroConta | null {
  if (!c.descricao.trim()) return "sem_descricao";
  if (!(c.valor > 0)) return "sem_valor";
  if (c.valor > 99_999_999) return "valor_alto";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.vencimento)) return "sem_vencimento";
  if (c.parcelas !== undefined) {
    if (!Number.isInteger(c.parcelas) || c.parcelas < 2 || c.parcelas > MAX_PARCELAS)
      return "parcelas_fora";
    if (Math.round(c.valor * 100) < c.parcelas) return "parcela_sem_valor";
  }
  return null;
}

export interface ParcelaGerada {
  parcela: number;
  parcelas: number;
  valor: number;
  vencimento: string;
}

/**
 * Divide o total em parcelas mensais a partir do primeiro vencimento, com o
 * mesmo dia de vencimento todo mês (31/01 → 28/02 → 31/03, regra de
 * proximoVencimento). Os centavos que não dividem certo vão na primeira:
 * R$ 100,00 em 3 = 33,34 + 33,33 + 33,33, e a soma bate com o total.
 */
export function dividirEmParcelas(
  total: number,
  parcelas: number,
  primeiroVencimento: string,
): ParcelaGerada[] {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / parcelas);
  const sobra = totalCents - base * parcelas;
  const dia = Number(primeiroVencimento.slice(8, 10));
  const lista: ParcelaGerada[] = [];
  let vencimento = primeiroVencimento;
  for (let i = 1; i <= parcelas; i++) {
    lista.push({
      parcela: i,
      parcelas,
      valor: (base + (i === 1 ? sobra : 0)) / 100,
      vencimento,
    });
    vencimento = proximoVencimento(vencimento, dia);
  }
  return lista;
}

/** "parcela 2 de 3", ou vazio quando a conta não é parcelada. */
export function rotuloDaParcela(c: Pick<ContaPagar, "parcela" | "parcelas">): string {
  return c.parcela && c.parcelas ? `parcela ${c.parcela} de ${c.parcelas}` : "";
}

export type Diferenca = { tipo: "juros" | "desconto"; valor: number } | null;

/**
 * Diferença entre o que saiu e o valor original da conta. Pagou mais = juros
 * ou multa; pagou menos = desconto. Igual (ou conta antiga sem valor pago) = null.
 */
export function diferencaDoPagamento(original: number, pago: number | null): Diferenca {
  if (pago === null) return null;
  const dif = Math.round(pago * 100) - Math.round(original * 100);
  if (dif === 0) return null;
  return { tipo: dif > 0 ? "juros" : "desconto", valor: Math.abs(dif) / 100 };
}

/** "R$ 12,08 a mais que o original (juros ou multa)". Vazio quando bate. */
export function fraseDiferenca(d: Diferenca): string {
  if (!d) return "";
  const v = formatarReais(d.valor, { sempreCentavos: true });
  return d.tipo === "juros"
    ? `${v} a mais que o original (juros ou multa)`
    : `${v} a menos que o original (desconto)`;
}
