// A receber no Financeiro (ONE-207 Fase 2). Regras sem React nem Supabase: a
// leitura e a escrita moram em components/financeiro/contasReceberDados.ts.
//
// A seção junta duas origens: contas a receber avulsas (tabela contas_receber:
// fiado, resto de encomenda, parcela da cliente) e vendas com status
// 'a_receber' (Vendas/Pedidos). Receber a conta passa pela RPC receber_conta;
// receber a venda, pela receber_venda de sempre.
//
// As regras de prazo (atrasada, vence hoje, semana) são as mesmas das contas
// a pagar: importadas de lib/contasPagar.ts, pra as duas listas falarem igual.

import { formatarReais } from "@/lib/formatarReais";
import { situacaoDaConta } from "@/lib/contasPagar";
import { taxaDaVenda, type FormaRecebimento, type RegraTaxa } from "@/lib/taxas";

export type StatusContaReceber = "a_receber" | "recebida";

export interface ContaReceber {
  id: string;
  descricao: string;
  cliente: string | null;
  documento: string | null;
  valor: number;
  vencimento: string; // AAAA-MM-DD
  categoria: string | null;
  parcela: number | null;
  parcelas: number | null;
  status: StatusContaReceber;
  recebidoEm: string | null;
  valorRecebido: number | null;
  forma: FormaRecebimento | null;
}

/** Venda registrada em Vendas/Pedidos que ainda não foi paga. */
export interface VendaAReceber {
  id: string;
  /** Data da venda. */
  data: string;
  /** Entrega do pedido, quando tem; senão a data da venda. É o "vencimento" da lista. */
  vencimento: string;
  canal: string;
  clienteNome: string | null;
  /** O que vai entrar no Financeiro: total - taxa - frete pago por ela (igual à RPC receber_venda). */
  liquido: number;
  /** Forma escolhida ao registrar a venda (ONE-207 Fase 3), quando tem. */
  forma: FormaRecebimento | null;
}

export type ItemAReceber =
  | { tipo: "conta"; id: string; vencimento: string; valor: number; conta: ContaReceber }
  | { tipo: "venda"; id: string; vencimento: string; valor: number; venda: VendaAReceber };

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Junta contas a receber e vendas a receber, por vencimento; no mesmo dia, a maior antes. */
export function listaAReceber(
  contas: readonly ContaReceber[],
  vendas: readonly VendaAReceber[],
): ItemAReceber[] {
  const itens: ItemAReceber[] = [
    ...contas
      .filter((c) => c.status === "a_receber")
      .map((c) => ({
        tipo: "conta" as const,
        id: c.id,
        vencimento: c.vencimento,
        valor: c.valor,
        conta: c,
      })),
    ...vendas.map((v) => ({
      tipo: "venda" as const,
      id: v.id,
      vencimento: v.vencimento,
      valor: v.liquido,
      venda: v,
    })),
  ];
  return itens.sort(
    (a, b) =>
      a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor || a.id.localeCompare(b.id),
  );
}

export interface ResumoAReceber {
  total: { quantidade: number; total: number };
  atrasadas: { quantidade: number; total: number };
  /** Vence hoje ou nos próximos 7 dias. */
  semana: { quantidade: number; total: number };
}

export function resumoAReceber(itens: readonly ItemAReceber[], hoje: string): ResumoAReceber {
  const r: ResumoAReceber = {
    total: { quantidade: 0, total: 0 },
    atrasadas: { quantidade: 0, total: 0 },
    semana: { quantidade: 0, total: 0 },
  };
  for (const i of itens) {
    r.total.quantidade += 1;
    r.total.total = centavos(r.total.total + i.valor);
    const s = situacaoDaConta(i.vencimento, hoje);
    const alvo = s === "atrasada" ? r.atrasadas : s === "hoje" || s === "semana" ? r.semana : null;
    if (!alvo) continue;
    alvo.quantidade += 1;
    alvo.total = centavos(alvo.total + i.valor);
  }
  return r;
}

/** "R$ 480,00 pra receber · 1 atrasada (R$ 180,00) · 2 vencem nos próximos 7 dias (R$ 300,00)". Vazio sem nada. */
export function fraseAReceber(r: ResumoAReceber): string {
  if (r.total.quantidade === 0) return "";
  const fmt = (v: number) => formatarReais(v, { sempreCentavos: true });
  const partes = [`${fmt(r.total.total)} pra receber`];
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

/**
 * Quanto deve cair na conta pela forma escolhida: o valor menos a taxa
 * cadastrada pra ela em Vendas (ONE-128). Sem taxa cadastrada, o valor cheio.
 * É sugestão: ela confere com o que caiu e corrige.
 */
export function valorQueDeveCair(valor: number, regra: RegraTaxa | null | undefined): number {
  return centavos(valor - taxaDaVenda(valor, regra));
}

/** Líquido da venda a receber, igual à RPC receber_venda. */
export function liquidoDaVenda(total: number, taxaCanal: number, custoEnvio: number): number {
  return centavos(centavos(total) - centavos(taxaCanal) - centavos(custoEnvio));
}

/**
 * "R$ 4,99 a menos que o combinado (taxa ou desconto)". Vazio quando bate.
 * Mesma conta de diferencaDoPagamento, com as palavras do lado de quem recebe.
 */
export function fraseDiferencaRecebida(original: number, recebido: number | null): string {
  if (recebido === null) return "";
  const dif = Math.round(recebido * 100) - Math.round(original * 100);
  if (dif === 0) return "";
  const v = formatarReais(Math.abs(dif) / 100, { sempreCentavos: true });
  return dif < 0
    ? `${v} a menos que o combinado (taxa ou desconto)`
    : `${v} a mais que o combinado (juros ou acréscimo)`;
}
