// Leitura e escrita do "A receber" do Financeiro (ONE-207 Fase 2). As regras
// ficam em lib/contasReceber.ts; aqui só a ponte com o Supabase. Receber e
// desfazer a conta passam pelas RPCs receber_conta e desfazer_recebimento;
// receber a venda, pela receber_venda de Vendas.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dividirEmParcelas } from "@/lib/contasPagar";
import {
  liquidoDaVenda,
  type ContaReceber,
  type StatusContaReceber,
  type VendaAReceber,
} from "@/lib/contasReceber";
import type { FormaRecebimento } from "@/lib/taxas";

type ContaBanco = {
  id: string;
  descricao: string;
  cliente: string | null;
  documento: string | null;
  valor: number;
  vencimento: string;
  categoria: string | null;
  parcela: number | null;
  parcelas: number | null;
  status: string;
  recebido_em: string | null;
  valor_recebido: number | null;
  forma: string | null;
};

const daLinha = (r: ContaBanco): ContaReceber => ({
  id: r.id,
  descricao: r.descricao,
  cliente: r.cliente,
  documento: r.documento,
  valor: Number(r.valor),
  vencimento: r.vencimento,
  categoria: r.categoria,
  parcela: r.parcela,
  parcelas: r.parcelas,
  status: r.status as StatusContaReceber,
  recebidoEm: r.recebido_em,
  valorRecebido: r.valor_recebido === null ? null : Number(r.valor_recebido),
  forma: r.forma as FormaRecebimento | null,
});

// custo_envio ainda não está nos tipos gerados (mesmo jeito de pedidos/dados.ts).
const COLUNAS_VENDA_A_RECEBER: string =
  "id, data, entrega_em, canal, cliente_nome, total, taxa_canal, custo_envio";

export const chaveAReceber = (userId: string | undefined) => ["a-receber", userId] as const;

/**
 * Contas a receber em aberto, as recebidas desde `recebidasDesde` (pra desfazer
 * engano recente) e as vendas com status a receber.
 */
export function useAReceber(userId: string | undefined, recebidasDesde: string) {
  return useQuery({
    queryKey: [...chaveAReceber(userId), recebidasDesde],
    enabled: !!userId && !!recebidasDesde,
    queryFn: async () => {
      const [contasRes, vendasRes] = await Promise.all([
        supabase
          .from("contas_receber")
          .select(
            "id, descricao, cliente, documento, valor, vencimento, categoria, parcela, parcelas, status, recebido_em, valor_recebido, forma",
          )
          .eq("user_id", userId!)
          .or(`status.eq.a_receber,recebido_em.gte.${recebidasDesde}`)
          .order("vencimento", { ascending: true })
          .limit(500),
        supabase
          .from("vendas")
          .select(COLUNAS_VENDA_A_RECEBER)
          .eq("user_id", userId!)
          .eq("status", "a_receber")
          .order("data", { ascending: true })
          .limit(500),
      ]);
      if (contasRes.error) throw contasRes.error;
      if (vendasRes.error) throw vendasRes.error;
      const contas = ((contasRes.data ?? []) as unknown as ContaBanco[]).map(daLinha);
      type VendaBanco = {
        id: string;
        data: string;
        entrega_em: string | null;
        canal: string;
        cliente_nome: string | null;
        total: number;
        taxa_canal: number;
        custo_envio: number | null;
      };
      const vendas: VendaAReceber[] = ((vendasRes.data ?? []) as unknown as VendaBanco[]).map(
        (v) => ({
          id: v.id,
          data: v.data,
          vencimento: v.entrega_em ?? v.data,
          canal: v.canal,
          clienteNome: v.cliente_nome,
          liquido: liquidoDaVenda(
            Number(v.total),
            Number(v.taxa_canal),
            Number(v.custo_envio ?? 0),
          ),
        }),
      );
      return { contas, vendas };
    },
  });
}

export interface ContaReceberParaSalvar {
  descricao: string;
  /** Na criação parcelada, o total: vira N contas, uma por mês. */
  valor: number;
  vencimento: string;
  categoria: string | null;
  cliente: string | null;
  documento: string | null;
  /** Só na criação. 2 ou mais divide o valor em parcelas mensais. */
  parcelas?: number;
}

export type ResultadoSalvar = "ok" | "ja_recebida" | "erro";

export async function salvarContaReceber(
  userId: string,
  conta: ContaReceberParaSalvar,
  idEdicao?: string,
): Promise<ResultadoSalvar> {
  const { parcelas, ...campos } = conta;
  const payload = {
    ...campos,
    descricao: campos.descricao.trim(),
    cliente: campos.cliente?.trim() || null,
    documento: campos.documento?.trim() || null,
  };
  if (!idEdicao) {
    // Parcelada entra como N linhas num insert só: ou entram todas, ou nenhuma.
    const linhas =
      parcelas && parcelas >= 2
        ? dividirEmParcelas(payload.valor, parcelas, payload.vencimento).map((p) => ({
            user_id: userId,
            ...payload,
            valor: p.valor,
            vencimento: p.vencimento,
            parcela: p.parcela,
            parcelas: p.parcelas,
          }))
        : [{ user_id: userId, ...payload }];
    const { error } = await supabase.from("contas_receber").insert(linhas);
    if (error) console.error("conta_receber_salvar", error);
    return error ? "erro" : "ok";
  }
  // A policy só deixa editar conta a receber. Recebida em outra aba: o update
  // passa sem erro e sem linha, e o select mostra isso.
  const { data, error } = await supabase
    .from("contas_receber")
    .update(payload)
    .eq("id", idEdicao)
    .select("id");
  if (error) {
    console.error("conta_receber_salvar", error);
    return "erro";
  }
  return data && data.length > 0 ? "ok" : "ja_recebida";
}

export const receberConta = (
  id: string,
  data: string,
  valorRecebido?: number,
  forma?: FormaRecebimento | null,
) =>
  supabase.rpc("receber_conta", {
    p_conta_id: id,
    p_data: data,
    ...(valorRecebido !== undefined ? { p_valor: valorRecebido } : {}),
    ...(forma ? { p_forma: forma } : {}),
  });

export const desfazerRecebimento = (id: string) =>
  supabase.rpc("desfazer_recebimento", { p_conta_id: id });

export const excluirContaReceber = (id: string) =>
  supabase.from("contas_receber").delete().eq("id", id);
