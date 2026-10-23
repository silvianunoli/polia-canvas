// Leitura e escrita de contas a pagar (ONE-127). As regras ficam em
// lib/contasPagar.ts; aqui só a ponte com o Supabase. Pagar e desfazer passam
// pelas RPCs pagar_conta e desfazer_pagamento, que mexem em lancamentos.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContaPagar, RecorrenciaConta, StatusConta } from "@/lib/contasPagar";

type ContaBanco = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  categoria: string | null;
  recorrencia: string;
  dia_recorrencia: number | null;
  status: string;
  pago_em: string | null;
};

const daLinha = (r: ContaBanco): ContaPagar => ({
  id: r.id,
  descricao: r.descricao,
  valor: Number(r.valor),
  vencimento: r.vencimento,
  categoria: r.categoria,
  recorrencia: r.recorrencia as RecorrenciaConta,
  diaRecorrencia: r.dia_recorrencia,
  status: r.status as StatusConta,
  pagoEm: r.pago_em,
});

export const chaveContas = (userId: string | undefined) => ["contas-pagar", userId] as const;

/**
 * Todas as contas a pagar e as pagas desde `pagasDesde` (AAAA-MM-DD). Paga
 * antiga já está no histórico como saída; aqui só serve pra desfazer engano
 * recente.
 */
export function useContasPagar(userId: string | undefined, pagasDesde: string) {
  return useQuery({
    queryKey: [...chaveContas(userId), pagasDesde],
    enabled: !!userId && !!pagasDesde,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select(
          "id, descricao, valor, vencimento, categoria, recorrencia, dia_recorrencia, status, pago_em",
        )
        .eq("user_id", userId!)
        .or(`status.eq.a_pagar,pago_em.gte.${pagasDesde}`)
        .order("vencimento", { ascending: true })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as ContaBanco[]).map(daLinha);
    },
  });
}

export interface ContaParaSalvar {
  descricao: string;
  valor: number;
  vencimento: string;
  categoria: string | null;
  recorrencia: RecorrenciaConta;
}

export type ResultadoSalvar = "ok" | "ja_paga" | "erro";

export async function salvarConta(
  userId: string,
  conta: ContaParaSalvar,
  idEdicao?: string,
): Promise<ResultadoSalvar> {
  const payload = { ...conta, descricao: conta.descricao.trim() };
  if (!idEdicao) {
    const { error } = await supabase.from("contas_pagar").insert({ user_id: userId, ...payload });
    if (error) console.error("conta_pagar_salvar", error);
    return error ? "erro" : "ok";
  }
  // A policy só deixa editar conta a pagar. Se ela foi paga em outra aba, o
  // update passa sem erro e sem linha: sem o select, o modal dizia "salvo".
  const { data, error } = await supabase
    .from("contas_pagar")
    .update(payload)
    .eq("id", idEdicao)
    .select("id");
  if (error) {
    console.error("conta_pagar_salvar", error);
    return "erro";
  }
  return data && data.length > 0 ? "ok" : "ja_paga";
}

export const pagarConta = (id: string, data: string) =>
  supabase.rpc("pagar_conta", { p_conta_id: id, p_data: data });

export const desfazerPagamento = (id: string) =>
  supabase.rpc("desfazer_pagamento", { p_conta_id: id });

/** O banco recusa desfazer quando a conta do mês seguinte já foi paga. */
export const ehMesSeguintePago = (erro: { message?: string } | null) =>
  !!erro?.message?.includes("Mês seguinte já pago");

export const excluirConta = (id: string) => supabase.from("contas_pagar").delete().eq("id", id);
