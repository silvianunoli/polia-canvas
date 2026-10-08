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
      // Leitura que falha não pode virar "ainda não está escrita" em /marca e
      // /mercado (08/10/2026): o erro sobe e a tela mostra o BlockError.
      const erro = (res as unknown as { error?: unknown }).error;
      if (erro) throw erro;
      const rows =
        (res as unknown as { data: { campo: string; valor: string | null }[] | null }).data ?? [];
      const m = new Map<string, string>();
      for (const r of rows) if (r.valor && r.valor.trim()) m.set(r.campo, r.valor);
      return m;
    },
  });
}
