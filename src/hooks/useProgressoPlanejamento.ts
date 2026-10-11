import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { progressoPlanejamento, type ProgressoPlanejamento } from "@/lib/lembretePlanejamento";

/** Chave do cache: o módulo do Planejamento invalida ao concluir uma seção. */
export const CHAVE_PROGRESSO_PLANEJAMENTO = "progresso-planejamento";

/**
 * Em qual módulo o Planejamento parou e quantas seções dele estão feitas.
 * `progresso` é null com os 6 módulos fechados; `undefined` enquanto carrega
 * ou se a leitura falhou (aí quem usa não mostra nada, em vez de chutar).
 */
export function useProgressoPlanejamento(): {
  progresso: ProgressoPlanejamento | null | undefined;
} {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const query = useQuery({
    queryKey: [CHAVE_PROGRESSO_PLANEJAMENTO, userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamento_secoes" as never)
        .select("secao")
        .eq("user_id", userId!)
        .eq("concluido", true);
      if (error) throw error;
      return progressoPlanejamento(
        new Set(((data ?? []) as { secao: string }[]).map((s) => s.secao)),
      );
    },
  });
  return { progresso: query.isSuccess ? query.data : undefined };
}
