// Quadro de Pedidos (GRW-93, plano docs/plano-quadro-de-pedidos.md, aprovado
// pela Sil em 28/10/2026). O pedido é uma venda com andamento e dia de entrega
// (migration 20261028140443_pedidos_quadro.sql). Aqui só regra pura: andamentos,
// atraso, o que mostrar no quadro e o resumo do dia. Leitura e escrita ficam
// em components/pedidos/dados.ts.

import { diasEntreDatas, somarDias } from "@/lib/data.functions";
import type { StatusVenda } from "@/lib/vendas";

export const ANDAMENTOS = ["a_fazer", "em_producao", "pronto", "entregue"] as const;
export type AndamentoPedido = (typeof ANDAMENTOS)[number];

export const ROTULO_ANDAMENTO: Record<AndamentoPedido, string> = {
  a_fazer: "A fazer",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
};

/** Mesmo teto da registrar_pedido no banco (A fazer, Em produção e Pronto). */
export const TETO_PEDIDOS_GRATIS = 15;

/** Entregue fica no quadro por esta quantidade de dias; o resto mora na lista de Vendas. */
export const DIAS_ENTREGUE_NO_QUADRO = 7;

export function ehAndamento(v: unknown): v is AndamentoPedido {
  return typeof v === "string" && (ANDAMENTOS as readonly string[]).includes(v);
}

export function proximoAndamento(e: AndamentoPedido): AndamentoPedido | null {
  const i = ANDAMENTOS.indexOf(e);
  return i < ANDAMENTOS.length - 1 ? ANDAMENTOS[i + 1] : null;
}

export interface PedidoResumo {
  andamento: AndamentoPedido;
  entregaEm: string;
  status: StatusVenda;
  total: number;
}

export function estaAberto(p: Pick<PedidoResumo, "andamento" | "status">): boolean {
  return p.status !== "cancelada" && p.andamento !== "entregue";
}

export function estaAtrasado(
  p: Pick<PedidoResumo, "andamento" | "status" | "entregaEm">,
  hoje: string,
) {
  return estaAberto(p) && p.entregaEm < hoje;
}

/** Quantos abertos contam pro teto do Grátis. */
export function contarAbertos(pedidos: readonly Pick<PedidoResumo, "andamento" | "status">[]) {
  return pedidos.filter(estaAberto).length;
}

const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function diaDaSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return DIA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/**
 * O que o cartão diz da entrega: "entrega hoje", "entrega amanhã",
 * "entrega qui 30/10", ou "atrasado desde 27/10". Entregue fala da data
 * combinada, sem cobrança.
 */
export function rotuloEntrega(
  p: Pick<PedidoResumo, "andamento" | "status" | "entregaEm">,
  hoje: string,
): { texto: string; atrasado: boolean } {
  if (p.andamento === "entregue")
    return { texto: `combinado pra ${ddmm(p.entregaEm)}`, atrasado: false };
  if (estaAtrasado(p, hoje))
    return { texto: `atrasado desde ${ddmm(p.entregaEm)}`, atrasado: true };
  const dias = diasEntreDatas(hoje, p.entregaEm);
  if (dias === 0) return { texto: "entrega hoje", atrasado: false };
  if (dias === 1) return { texto: "entrega amanhã", atrasado: false };
  return { texto: `entrega ${diaDaSemana(p.entregaEm)} ${ddmm(p.entregaEm)}`, atrasado: false };
}

/**
 * Fica no quadro: aberto (de qualquer data) ou entregue com entrega combinada
 * nos últimos 7 dias. Cancelado sai.
 */
export function ficaNoQuadro(
  p: Pick<PedidoResumo, "andamento" | "status" | "entregaEm">,
  hoje: string,
) {
  if (p.status === "cancelada") return false;
  if (p.andamento !== "entregue") return true;
  return p.entregaEm >= somarDias(hoje, -DIAS_ENTREGUE_NO_QUADRO);
}

/** Ordem dentro da coluna: o que vence primeiro em cima. */
export function ordenarPorEntrega<T extends Pick<PedidoResumo, "entregaEm">>(lista: readonly T[]) {
  return [...lista].sort((a, b) => a.entregaEm.localeCompare(b.entregaEm));
}

export interface ResumoDoDia {
  hoje: number;
  amanha: number;
  atrasados: number;
  /** A receber dos abertos com entrega até daqui a 6 dias, atrasados inclusos. */
  entraNaSemana: number;
  abertos: number;
}

export function resumoDoDia(pedidos: readonly PedidoResumo[], hoje: string): ResumoDoDia {
  const amanha = somarDias(hoje, 1);
  const fimSemana = somarDias(hoje, 6);
  const r: ResumoDoDia = { hoje: 0, amanha: 0, atrasados: 0, entraNaSemana: 0, abertos: 0 };
  for (const p of pedidos) {
    if (!estaAberto(p)) continue;
    r.abertos += 1;
    if (p.entregaEm === hoje) r.hoje += 1;
    else if (p.entregaEm === amanha) r.amanha += 1;
    else if (p.entregaEm < hoje) r.atrasados += 1;
    if (p.status === "a_receber" && p.entregaEm <= fimSemana) {
      r.entraNaSemana = Math.round((r.entraNaSemana + p.total) * 100) / 100;
    }
  }
  return r;
}

/** "Hoje: 2 entregas · Amanhã: 1 · Atrasados: 1", só com o que tem número. */
export function linhaDoResumo(r: ResumoDoDia): string {
  const partes: string[] = [];
  if (r.hoje) partes.push(`Hoje: ${r.hoje} ${r.hoje === 1 ? "entrega" : "entregas"}`);
  if (r.amanha) partes.push(`Amanhã: ${r.amanha}`);
  if (r.atrasados) partes.push(`Atrasados: ${r.atrasados}`);
  if (partes.length === 0) {
    return r.abertos === 0
      ? "Nenhum pedido aberto."
      : `${r.abertos} ${r.abertos === 1 ? "pedido aberto" : "pedidos abertos"}, nenhum pra hoje.`;
  }
  return partes.join(" · ");
}

/** O Grátis bateu no teto: o botão Novo pedido explica em vez de abrir o modal. */
export function tetoAtingido(ehGratis: boolean, abertos: number): boolean {
  return ehGratis && abertos >= TETO_PEDIDOS_GRATIS;
}

/** A trigger/RPC recusou pelo teto do Grátis. */
export function ehErroDeTeto(mensagem: string | null | undefined): boolean {
  return !!mensagem && /15 pedidos abertos/.test(mensagem);
}
