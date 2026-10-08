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
 * Depois de entrar, decide o destino:
 * - /onboarding quando o perfil diz que o onboarding não terminou (ou o perfil
 *   ainda não existe, conta nova)
 * - /painel quando terminou
 *
 * Erro de leitura NÃO é "onboarding pendente": quem já usa a Pólia caía no
 * onboarding por um soluço de rede. Tenta de novo uma vez; se falhar de novo,
 * vai pro /painel (o guard da área logada confere de novo lá).
 */
export async function resolvePostLoginPath(userId: string): Promise<string> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", userId)
        .maybeSingle();
      if (!error) return data?.onboarding_completed ? "/painel" : "/onboarding";
    } catch {
      // cai pra próxima tentativa
    }
  }
  return "/painel";
}
