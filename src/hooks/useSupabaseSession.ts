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
 * After login, decide where to send the user:
 * - to /onboarding if profile.onboarding_completed is false (or missing)
 * - to /painel otherwise
 */
export async function resolvePostLoginPath(userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (data?.onboarding_completed) return "/painel";
    return "/onboarding";
  } catch {
    return "/onboarding";
  }
}
