import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { emSegundoPlano } from "@/lib/segundo-plano.server";

// Lado servidor da instrumentação do Founder Dashboard (ver founder-eventos.ts).
// Tudo aqui roda em segundo plano (ctx.waitUntil no Worker) e engole erro:
// telemetria nunca derruba nem atrasa a chamada que está medindo.

function ambiente(): "prod" | "preview" | "dev" {
  const v = process.env.FOUNDER_AMBIENTE;
  return v === "preview" || v === "dev" ? v : "prod";
}

export function registrarEventoServidor(input: {
  evento: string;
  userId: string | null;
  feature?: string;
  propriedades?: Record<string, Json | undefined>;
}): void {
  emSegundoPlano(
    supabaseAdmin.from("founder_eventos").insert({
      user_id: input.userId,
      sessao_id: crypto.randomUUID(),
      evento: input.evento,
      feature: input.feature ?? null,
      pagina: null,
      ambiente: ambiente(),
      origem: "server",
      propriedades: (input.propriedades ?? {}) as Json,
    }),
  );
}

export type TipoEventoSistema =
  | "api_error"
  | "job_failure"
  | "integration_failure"
  | "latency"
  | "ia_call"
  | "ia_failure"
  | "webhook_failure";

export function registrarEventoSistema(input: {
  tipo: TipoEventoSistema;
  origem: string;
  servico?: string;
  detalhes?: Record<string, Json | undefined>;
  latenciaMs?: number;
}): void {
  emSegundoPlano(
    supabaseAdmin.from("founder_eventos_sistema").insert({
      tipo: input.tipo,
      origem: input.origem,
      servico: input.servico ?? null,
      detalhes: (input.detalhes ?? {}) as Json,
      latencia_ms: input.latenciaMs ?? null,
    }),
  );
}

export function registrarChamadaApi(input: {
  fn: string;
  tipo: "server_fn" | "ssr";
  metodo?: string;
  ok: boolean;
  status?: number;
  latenciaMs: number;
  userId?: string | null;
}): void {
  emSegundoPlano(
    supabaseAdmin.from("founder_api_chamadas").insert({
      fn: input.fn.slice(0, 200),
      tipo: input.tipo,
      metodo: input.metodo ?? null,
      ok: input.ok,
      status: input.status ?? null,
      latencia_ms: input.latenciaMs,
      user_id: input.userId ?? null,
    }),
  );
}

// Diagnóstico temporário (?founder-debug=1): grava uma linha e devolve o
// resultado, pra enxergar em produção por que a telemetria não chega ao banco.
export async function testarGravacaoApi(): Promise<string> {
  try {
    const { error } = await supabaseAdmin.from("founder_api_chamadas").insert({
      fn: "__debug",
      tipo: "ssr",
      ok: true,
      status: 200,
      latencia_ms: 0,
    });
    const env = `url=${process.env.SUPABASE_URL ? "sim" : "nao"} key=${process.env.SUPABASE_SERVICE_ROLE_KEY ? "sim" : "nao"}`;
    return error ? `erro: ${error.code ?? ""} ${error.message} (${env})` : `ok (${env})`;
  } catch (e) {
    return `excecao: ${e instanceof Error ? e.message : String(e)}`;
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
