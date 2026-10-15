import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Set up listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) {
        setSession(s);
        setLoading(false);
      }
    });

    // Then hydrate
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading, user: session?.user ?? null };
}

/**
 * Destino depois de entrar: sempre o /painel, desde 14/10/2026. Até então
 * conta com onboarding pendente ia pro /onboarding; agora o onboarding não é
 * mais etapa obrigatória e a conta nova vê o bloco "Primeiros passos" no
 * próprio Painel. A assinatura (com o id) fica pra não mexer em quem chama.
 */
export async function resolvePostLoginPath(_userId: string): Promise<string> {
  return "/painel";
}
