// Leitura e escrita de equipamentos (ONE-193). Escrita só por RPC (migration
// 20261108200000); a tabela é só de leitura pela API. Desfazer a compra é
// excluir a saída: o banco devolve o equipamento pra planejado sozinho.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Equipamento } from "@/lib/equipamentos";

export const chaveEquipamentos = (userId: string | undefined) => ["equipamentos", userId] as const;

export function useEquipamentos(userId: string | undefined, ligado = true) {
  return useQuery({
    queryKey: chaveEquipamentos(userId),
    enabled: !!userId && ligado,
    queryFn: async (): Promise<Equipamento[]> => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("id, nome, valor, meses_uso, lancamento_id, lancamentos(data, valor)")
        .eq("user_id", userId!)
        .eq("arquivado", false)
        .order("created_at")
        .order("id");
      if (error) throw error;
      return (data ?? []).map((e) => ({
        id: e.id,
        nome: e.nome,
        // Comprado vale o que saiu no Financeiro, que também é editável por lá.
        valor: Number(e.lancamentos?.valor ?? e.valor),
        mesesUso: e.meses_uso,
        lancamentoId: e.lancamento_id,
        compradoEm: e.lancamentos?.data ?? null,
      }));
    },
  });
}

export function salvarEquipamento(p: {
  id: string | null;
  nome: string;
  valor: number;
  meses: number;
}) {
  return supabase.rpc("salvar_equipamento", {
    p_id: p.id,
    p_nome: p.nome,
    p_valor: p.valor,
    p_meses: p.meses,
  });
}

export function marcarEquipamentoComprado(p: { id: string; data: string; valor: number }) {
  return supabase.rpc("marcar_equipamento_comprado", {
    p_id: p.id,
    p_data: p.data,
    p_valor: p.valor,
  });
}

export function arquivarEquipamento(id: string) {
  return supabase.rpc("arquivar_equipamento", { p_id: id });
}

export function desfazerCompra(lancamentoId: string) {
  return supabase.from("lancamentos").delete().eq("id", lancamentoId);
}
