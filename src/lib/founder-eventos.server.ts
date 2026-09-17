import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

// Lado servidor da instrumentação do Founder Dashboard (ver founder-eventos.ts).
// Tudo aqui é fire-and-forget com catch: telemetria nunca derruba a chamada
// que está medindo.

function ambiente(): "prod" | "preview" | "dev" {
  const v = process.env.FOUNDER_AMBIENTE;
  return v === "preview" || v === "dev" ? v : "prod";
}

export async function registrarEventoServidor(input: {
  evento: string;
  userId: string | null;
  feature?: string;
  propriedades?: Record<string, Json | undefined>;
}): Promise<void> {
  try {
    await supabaseAdmin.from("founder_eventos").insert({
      user_id: input.userId,
      sessao_id: crypto.randomUUID(),
      evento: input.evento,
      feature: input.feature ?? null,
      pagina: null,
      ambiente: ambiente(),
      origem: "server",
      propriedades: (input.propriedades ?? {}) as Json,
    });
  } catch {
    // nunca quebra a ação instrumentada
  }
}

export type TipoEventoSistema =
  | "api_error"
  | "job_failure"
  | "integration_failure"
  | "latency"
  | "ia_call"
  | "ia_failure"
  | "webhook_failure";

export async function registrarEventoSistema(input: {
  tipo: TipoEventoSistema;
  origem: string;
  servico?: string;
  detalhes?: Record<string, Json | undefined>;
  latenciaMs?: number;
}): Promise<void> {
  try {
    await supabaseAdmin.from("founder_eventos_sistema").insert({
      tipo: input.tipo,
      origem: input.origem,
      servico: input.servico ?? null,
      detalhes: (input.detalhes ?? {}) as Json,
      latencia_ms: input.latenciaMs ?? null,
    });
  } catch {
    // idem
  }
}

export async function registrarChamadaApi(input: {
  fn: string;
  tipo: "server_fn" | "ssr";
  metodo?: string;
  ok: boolean;
  status?: number;
  latenciaMs: number;
  userId?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin.from("founder_api_chamadas").insert({
      fn: input.fn.slice(0, 200),
      tipo: input.tipo,
      metodo: input.metodo ?? null,
      ok: input.ok,
      status: input.status ?? null,
      latencia_ms: input.latenciaMs,
      user_id: input.userId ?? null,
    });
  } catch {
    // idem
  }
}

// Só pra atribuir a chamada à conta na telemetria: lê o `sub` do JWT sem
// validar assinatura. Autorização de verdade continua no requireSupabaseAuth.
export function subDoBearer(authorization: string | null): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const partes = authorization.slice(7).split(".");
  if (partes.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
