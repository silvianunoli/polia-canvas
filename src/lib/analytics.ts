import { supabase } from "@/integrations/supabase/client";
import { hasConsent } from "@/lib/cookieConsent";
import type { Json } from "@/integrations/supabase/types";

// Analytics próprio, sem terceiro: grava pageviews e eventos customizados em
// eventos_analytics. Minimização LGPD — sem IP, sem user agent, sem geo.
// Só grava se a usuária aceitou cookies de análise (banner em CookieConsent).
const SESSAO_KEY = "polia-sessao-analytics";

function getSessaoId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSAO_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSAO_KEY, id);
  }
  return id;
}

export async function track(evento: string, propriedades?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!hasConsent("analytics")) return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase.from("eventos_analytics").insert({
      evento,
      pagina: window.location.pathname,
      sessao_id: getSessaoId(),
      user_id: session?.user.id ?? null,
      propriedades: (propriedades ?? {}) as Json,
    });
  } catch {
    // Analytics nunca pode quebrar a experiência da usuária.
  }
}
