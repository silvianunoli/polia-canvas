// Giro de cada variação e de cada insumo nos últimos JANELA_DIAS (ONE-134):
// quanto saiu, pela data da venda ou da produção (sem cancelada nem
// desfeita), e desde quando há histórico. Somado no banco
// (giro_por_sku / giro_por_insumo) e lido página por página: o PostgREST
// corta em 1.000 linhas sem avisar.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hojeISO, somarDias } from "@/lib/data.functions";
import { lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { JANELA_DIAS } from "@/lib/reposicao";
import { chaveEstoque } from "@/components/vendas/dados";
import { chaveInsumos } from "./insumosDados";

export interface Giro {
  saiu: number;
  /** Cadastro ou primeira saída, o que vier antes ("YYYY-MM-DD"). */
  inicio: string | null;
}

const desde = () => somarDias(hojeISO(), -JANELA_DIAS);

/** sku_id → giro. Uma linha por variação ativa. */
export function useGiroPorSku(userId: string | undefined) {
  return useQuery({
    queryKey: [...chaveEstoque(userId), "giro"],
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, Giro>> => {
      const inicio = desde();
      const linhas = await lerTodasAsPaginas((de, ate) =>
        supabase.rpc("giro_por_sku", { p_desde: inicio }).order("sku_id").range(de, ate),
      );
      return new Map(
        linhas.map((l) => [l.sku_id, { saiu: Number(l.saiu), inicio: l.inicio }] as const),
      );
    },
  });
}

/** insumo_id → giro (produção mais perda; decisão da Sil, 24/10). Uma linha por insumo ativo. */
export function useGiroPorInsumo(userId: string | undefined) {
  return useQuery({
    queryKey: [...chaveInsumos(userId), "giro"],
    enabled: !!userId,
    queryFn: async (): Promise<Map<string, Giro>> => {
      const inicio = desde();
      const linhas = await lerTodasAsPaginas((de, ate) =>
        supabase.rpc("giro_por_insumo", { p_desde: inicio }).order("insumo_id").range(de, ate),
      );
      return new Map(
        linhas.map((l) => [l.insumo_id, { saiu: Number(l.consumo), inicio: l.inicio }] as const),
      );
    },
  });
}
