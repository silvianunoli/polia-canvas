import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { moduloLiberado } from "@/lib/planejamento";

/**
 * Link pro Planejamento a partir de um estado vazio (08/10/2026).
 *
 * Os vazios de Produtos, Metas, Caderno e Mapa de Mercado mandavam direto pro
 * módulo 3, 6, 5 ou 2. Pra quem ainda está no Módulo 1, o módulo está
 * trancado e o clique caía numa tela fechada. Agora o link só aponta pro
 * módulo quando ele está liberado (mesma regra do /planejamento); fora disso,
 * ou enquanto não se sabe, leva pro /planejamento, que mostra onde ela está.
 */
export function useLinkDoModulo(n: number): { href: string; liberado: boolean } {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const query = useQuery({
    queryKey: ["planejamento-secoes-concluidas", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamento_secoes" as never)
        .select("secao, concluido")
        .eq("user_id", userId!);
      if (error) throw error;
      const linhas = (data ?? []) as unknown as { secao: string; concluido: boolean }[];
      return new Set(linhas.filter((l) => l.concluido).map((l) => l.secao));
    },
  });
  const liberado = !!query.data && moduloLiberado(n, query.data);
  return { href: liberado ? `/planejamento/modulo/${n}` : "/planejamento", liberado };
}
