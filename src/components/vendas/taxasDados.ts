// Leitura e gravação das taxas de recebimento (ONE-128). A regra de conta mora
// em lib/taxas.ts; aqui só a ponte com o Supabase.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FORMAS_RECEBIMENTO,
  MARKETPLACES_COM_TAXA,
  ehChaveDeMarketplaceProprio,
  type ChaveTaxa,
  type MarketplaceProprio,
  type RegraTaxa,
} from "@/lib/taxas";

/**
 * Taxas da conta por chave. No TikTok Shop, percentual e fixo em branco (0)
 * querem dizer "tabela oficial" (_shared/taxaTiktokShop.ts) e `freteGratis` vale
 * pra ela; preenchidos, valem no lugar da tabela. `proprios` são os
 * marketplaces que a dona criou à mão.
 */
export type TaxasDaConta = Partial<Record<ChaveTaxa, RegraTaxa & { freteGratis?: boolean }>> & {
  proprios?: MarketplaceProprio[];
};

const CHAVES_CONHECIDAS: readonly string[] = [...FORMAS_RECEBIMENTO, ...MARKETPLACES_COM_TAXA];

export const chaveTaxas = (userId: string | undefined) => ["taxas-recebimento", userId] as const;

export function useTaxas(userId: string | undefined) {
  return useQuery({
    queryKey: chaveTaxas(userId),
    enabled: !!userId,
    queryFn: async (): Promise<TaxasDaConta> => {
      const { data, error } = await supabase
        .from("taxas_recebimento")
        .select("chave, percentual, fixo, frete_gratis, nome")
        .eq("user_id", userId!)
        .order("nome" as never, { ascending: true, nullsFirst: true });
      if (error) throw error;
      const taxas: TaxasDaConta = {};
      const proprios: MarketplaceProprio[] = [];
      for (const r of (data ?? []) as unknown as Array<{
        chave: string;
        percentual: number;
        fixo: number;
        frete_gratis: boolean | null;
        nome: string | null;
      }>) {
        const regra = { percentual: Number(r.percentual), fixo: Number(r.fixo) };
        if (CHAVES_CONHECIDAS.includes(r.chave))
          taxas[r.chave as ChaveTaxa] = { ...regra, freteGratis: r.frete_gratis === true };
        else if (ehChaveDeMarketplaceProprio(r.chave) && r.nome)
          proprios.push({ chave: r.chave, nome: r.nome, regra });
      }
      if (proprios.length) taxas.proprios = proprios;
      return taxas;
    },
  });
}

/**
 * Grava as taxas da tela: as chaves fixas que vierem em `taxas`, os
 * marketplaces próprios (com nome) e apaga os próprios que ela tirou.
 */
export async function salvarTaxas(userId: string, taxas: TaxasDaConta, propriosRemovidos: string[] = []) {
  const linhas: Array<Record<string, unknown>> = [];
  for (const chave of CHAVES_CONHECIDAS) {
    const r = taxas[chave as ChaveTaxa];
    if (r) linhas.push({ user_id: userId, chave, percentual: r.percentual, fixo: r.fixo });
  }
  if (linhas.length) {
    const { error } = await supabase.from("taxas_recebimento").upsert(linhas as never, { onConflict: "user_id,chave" });
    if (error) return { error };
  }
  const proprios = (taxas.proprios ?? []).map((m) => ({
    user_id: userId,
    chave: m.chave,
    nome: m.nome,
    percentual: m.regra.percentual,
    fixo: m.regra.fixo,
  }));
  if (proprios.length) {
    const { error } = await supabase.from("taxas_recebimento").upsert(proprios as never, { onConflict: "user_id,chave" });
    if (error) return { error };
  }
  if (propriosRemovidos.length) {
    const { error } = await supabase
      .from("taxas_recebimento")
      .delete()
      .eq("user_id", userId)
      .in("chave", propriosRemovidos.filter(ehChaveDeMarketplaceProprio));
    if (error) return { error };
  }
  return { error: null };
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
