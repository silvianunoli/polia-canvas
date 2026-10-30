import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { novidadesDaConta, type LinhaAviso, type Novidade } from "@/lib/avisos";

// Dados do sino e da janela de Novidades (ONE-152). Tudo pelo Supabase com RLS
// de dona: avisos só da conta, novidades publicadas pra quem tem conta, e o
// "já li" de cada novidade em novidades_lidas.

export const CHAVE_AVISOS = "avisos-sino";

// Sem tempo real por enquanto: confere a cada minuto e quando a aba volta.
const INTERVALO_MS = 60_000;

export interface DadosAvisos {
  avisos: LinhaAviso[];
  novidades: Novidade[];
  lidas: Set<string>;
}

export function useAvisos() {
  const { session } = useSupabaseSession();
  const userId = session?.user?.id;
  const criadaEm = session?.user?.created_at;
  return useQuery({
    queryKey: [CHAVE_AVISOS, userId],
    enabled: !!userId,
    refetchInterval: INTERVALO_MS,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DadosAvisos> => {
      const [av, nov, lid] = await Promise.all([
        supabase
          .from("avisos" as never)
          .select("id, tipo, titulo, corpo, valor, link, lido_em, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("novidades" as never)
          .select("id, titulo, texto, imagem_url, link, link_rotulo, publicada_em")
          .order("publicada_em", { ascending: false })
          .limit(20),
        supabase.from("novidades_lidas" as never).select("novidade_id").eq("user_id", userId!),
      ]);
      if (av.error) throw av.error;
      if (nov.error) throw nov.error;
      if (lid.error) throw lid.error;
      return {
        avisos: (av.data ?? []) as unknown as LinhaAviso[],
        novidades: novidadesDaConta((nov.data ?? []) as unknown as Novidade[], criadaEm),
        lidas: new Set(((lid.data ?? []) as unknown as Array<{ novidade_id: string }>).map((l) => l.novidade_id)),
      };
    },
  });
}

/** Marca avisos e novidades como lidos e atualiza o sino. */
export function useMarcarLidos() {
  const qc = useQueryClient();
  const { session } = useSupabaseSession();
  const userId = session?.user?.id;
  return async (avisoIds: string[], novidadeIds: string[]) => {
    if (!userId || (!avisoIds.length && !novidadeIds.length)) return;
    await Promise.all([
      avisoIds.length
        ? supabase
            .from("avisos" as never)
            .update({ lido_em: new Date().toISOString() } as never)
            .in("id", avisoIds)
            .is("lido_em", null)
        : Promise.resolve(),
      novidadeIds.length
        ? supabase
            .from("novidades_lidas" as never)
            .upsert(novidadeIds.map((id) => ({ user_id: userId, novidade_id: id })) as never, {
              onConflict: "user_id,novidade_id",
              ignoreDuplicates: true,
            })
        : Promise.resolve(),
    ]);
    await qc.invalidateQueries({ queryKey: [CHAVE_AVISOS, userId] });
  };
}
