import { useQuery } from "@tanstack/react-query";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { flagAtiva } from "@/lib/flags";
import { SEM_ACESSO_INTERNO, type AcessoInterno } from "@/lib/ferramentasInternas";

/**
 * Planner, Caderno e Planejamento pra conta interna (flags `planner`, `caderno`
 * e `planejamento`). Até a leitura chegar, e se ela falhar, os três ficam
 * escondidos: quem não tem acesso nunca vê o item piscar.
 */
export function useFerramentasInternas(): AcessoInterno {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const query = useQuery({
    queryKey: ["ferramentas-internas", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AcessoInterno> => {
      const [planner, caderno, planejamento] = await Promise.all([
        flagAtiva("planner", userId, false),
        flagAtiva("caderno", userId, false),
        flagAtiva("planejamento", userId, false),
      ]);
      return { planner, caderno, planejamento };
    },
  });
  return query.data ?? SEM_ACESSO_INTERNO;
}
