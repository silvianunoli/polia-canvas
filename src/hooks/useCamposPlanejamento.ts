import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Lê os campos materializados do planejamento (KV planejamento_campos).
export function useCamposPlanejamento(userId?: string) {
  return useQuery({
    queryKey: ["planejamento-campos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await supabase
        .from("planejamento_campos" as never)
        .select("campo, valor")
        .eq("user_id", userId!);
      const rows =
        (res as unknown as { data: { campo: string; valor: string | null }[] | null }).data ?? [];
      const m = new Map<string, string>();
      for (const r of rows) if (r.valor && r.valor.trim()) m.set(r.campo, r.valor);
      return m;
    },
  });
}
