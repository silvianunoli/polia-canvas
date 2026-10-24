import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { testeDoBanco, type TestePro } from "@/lib/testePro";

/** A linha de `testes_pro` da própria conta (null se nunca teve teste). */
export function useTestePro() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  return useQuery<TestePro | null>({
    queryKey: ["teste-pro", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testes_pro" as never)
        .select("inicio, fim, encerrado_em, resultado, bonus_passos_em, origem")
        .eq("user_id", userId!)
        .maybeSingle();
      // Sem a linha (ou falha de leitura) a faixa só não aparece.
      if (error) return null;
      return testeDoBanco(data);
    },
  });
}
