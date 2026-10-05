import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { deveMostrar, esquecerVista, marcarVista, type ChaveDica } from "@/lib/dicas";

/**
 * Quais dicas (tour + primeira visita de cada tela) a usuária já viu.
 * Marcar é otimista: a dica some na hora e a gravação vai em seguida. Se a
 * gravação falhar, a dica só volta no próximo load; não vale travar a tela
 * nem mostrar erro por causa de uma dica.
 */
export function useDicasVistas() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const queryKey = ["dicas-vistas", userId];

  const query = useQuery<string[]>({
    queryKey,
    enabled: !!userId,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("dicas_vistas")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data?.dicas_vistas ?? [];
    },
  });

  const gravar = useCallback(
    (proxima: (atual: string[]) => string[]) => {
      if (!userId) return;
      const atual = qc.getQueryData<string[]>(["dicas-vistas", userId]);
      if (atual === undefined) return;
      const nova = proxima(atual);
      qc.setQueryData(["dicas-vistas", userId], nova);
      void supabase.from("profiles").update({ dicas_vistas: nova }).eq("id", userId);
    },
    [qc, userId],
  );

  const vistas = query.isSuccess ? query.data : undefined;

  return {
    /** A lista já chegou (ou falhou): dá pra decidir se o tour vai abrir. */
    pronto: query.isSuccess || query.isError,
    mostrar: (chave: ChaveDica) => deveMostrar(vistas, chave),
    marcar: (chave: ChaveDica) => gravar((v) => marcarVista(v, chave)),
    esquecer: (chave: ChaveDica) => gravar((v) => esquecerVista(v, chave)),
  };
}
