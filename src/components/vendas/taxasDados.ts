// Leitura e gravação das taxas de recebimento (ONE-128). A regra de conta mora
// em lib/taxas.ts; aqui só a ponte com o Supabase.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChaveTaxa, RegraTaxa } from "@/lib/taxas";

/** Na linha do TikTok Shop só vale `freteGratis`: a tarifa é a tabela oficial (_shared/taxaTiktokShop.ts). */
export type TaxasDaConta = Partial<Record<ChaveTaxa, RegraTaxa & { freteGratis?: boolean }>>;

export const chaveTaxas = (userId: string | undefined) => ["taxas-recebimento", userId] as const;

export function useTaxas(userId: string | undefined) {
  return useQuery({
    queryKey: chaveTaxas(userId),
    enabled: !!userId,
    queryFn: async (): Promise<TaxasDaConta> => {
      const { data, error } = await supabase
        .from("taxas_recebimento")
        .select("chave, percentual, fixo, frete_gratis")
        .eq("user_id", userId!);
      if (error) throw error;
      const taxas: TaxasDaConta = {};
      for (const r of data ?? [])
        taxas[r.chave as ChaveTaxa] = {
          percentual: Number(r.percentual),
          fixo: Number(r.fixo),
          freteGratis: r.frete_gratis === true,
        };
      return taxas;
    },
  });
}

export async function salvarTaxas(userId: string, taxas: TaxasDaConta) {
  const linhas = Object.entries(taxas).map(([chave, r]) => ({
    user_id: userId,
    chave,
    percentual: r!.percentual,
    fixo: r!.fixo,
  }));
  if (linhas.length === 0) return { error: null };
  return supabase.from("taxas_recebimento").upsert(linhas, { onConflict: "user_id,chave" });
}

/** Liga ou desliga o Frete Grátis do TikTok sem mexer no resto da linha. */
export async function salvarFreteGratisTiktok(userId: string, ligado: boolean) {
  return supabase
    .from("taxas_recebimento")
    .upsert(
      { user_id: userId, chave: "tiktok_shop", frete_gratis: ligado },
      { onConflict: "user_id,chave" },
    );
}
