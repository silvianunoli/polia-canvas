// Contas a pagar (ONE-127). Regras sem React nem Supabase: a leitura e a
// escrita moram em components/financeiro/contasPagarDados.ts. Pagar e desfazer
// são RPCs (pagar_conta, desfazer_pagamento) porque mexem em lancamentos e
// criam a conta do mês seguinte numa transação só.

import { formatarReais } from "@/lib/formatarReais";

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

export type ErroConta = "sem_descricao" | "sem_valor" | "sem_vencimento" | "valor_alto";

export function validarConta(c: {
  descricao: string;
  valor: number;
  vencimento: string;
}): ErroConta | null {
  if (!c.descricao.trim()) return "sem_descricao";
  if (!(c.valor > 0)) return "sem_valor";
  if (c.valor > 99_999_999) return "valor_alto";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.vencimento)) return "sem_vencimento";
  return null;
}
