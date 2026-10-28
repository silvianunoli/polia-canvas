import { useQuery } from "@tanstack/react-query";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { flagAtiva } from "@/lib/flags";
import { SEM_ACESSO_INTERNO, type AcessoInterno } from "@/lib/ferramentasInternas";

/**
 * Planner e Caderno pra conta interna (flags `planner` e `caderno`). Até a
 * leitura chegar, e se ela falhar, os dois ficam escondidos: quem não tem
 * acesso nunca vê o item piscar.
 */
export function useFerramentasInternas(): AcessoInterno {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const query = useQuery({
    queryKey: ["ferramentas-internas", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AcessoInterno> => {
      const [planner, caderno] = await Promise.all([
        flagAtiva("planner", userId, false),
        flagAtiva("caderno", userId, false),
      ]);
      return { planner, caderno };
    },
  });
  return query.data ?? SEM_ACESSO_INTERNO;
}
