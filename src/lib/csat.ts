import { supabase } from "@/integrations/supabase/client";

export type CsatTriggerType = "entregavel_concluido" | "chamado_resolvido" | "pulso_periodico";
export type CsatScore = 1 | 2 | 3;

// Cooldown entre prompts de CSAT de qualquer tipo, pra não empilhar vários
// pop-ups na mesma sessão (ex: concluir dois módulos seguidos).
const COOLDOWN_DIAS = 14;
const CHAVE_ULTIMO_PROMPT = "polia-csat-ultimo";
const CHAVE_CONTEXTOS_VISTOS = "polia-csat-vistos";

function contextosVistos(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CHAVE_CONTEXTOS_VISTOS);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

// A dona não tem SELECT em feedback_responses (RLS só permite INSERT), então
// o dedupe de "já vi esse contexto" e o cooldown geral vivem só no client.
export function podeMostrarCsat(contextRef: string): boolean {
  if (typeof window === "undefined") return false;
  if (contextosVistos().has(contextRef)) return false;
  const ultimo = window.localStorage.getItem(CHAVE_ULTIMO_PROMPT);
  if (!ultimo) return true;
  const dias = (Date.now() - Number(ultimo)) / (1000 * 60 * 60 * 24);
  return dias >= COOLDOWN_DIAS;
}

export function marcarCsatMostrado(contextRef: string) {
  if (typeof window === "undefined") return;
  try {
    const vistos = contextosVistos();
    vistos.add(contextRef);
    window.localStorage.setItem(CHAVE_CONTEXTOS_VISTOS, JSON.stringify(Array.from(vistos)));
    window.localStorage.setItem(CHAVE_ULTIMO_PROMPT, String(Date.now()));
  } catch {
    // localStorage indisponível (modo privado etc) — só significa que pode
    // perguntar de novo mais cedo, não é motivo pra travar a UX.
  }
}

export async function csatFlagAtiva(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "csat_modal_ativo")
      .maybeSingle();
    return data?.enabled ?? false;
  } catch {
    return false;
  }
}

// Fire-and-forget, como error-log.ts: uma falha aqui nunca pode travar a
// usuária nem virar um erro visível.
export async function enviarFeedback(
  triggerType: CsatTriggerType,
  contextRef: string,
  score: CsatScore,
  comment?: string,
) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user.id) return;
    await supabase.from("feedback_responses").insert({
      user_id: session.user.id,
      trigger_type: triggerType,
      context_ref: contextRef,
      score,
      comment: comment?.trim() ? comment.trim().slice(0, 1000) : null,
    });
  } catch {
    // Silencioso de propósito — ver comentário acima.
  }
}
