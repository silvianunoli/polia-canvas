// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response. Also
// persiste em erros_app (origem "server") — antes esse erro só existia 5s em
// memória e sumia se ninguém consumisse a tempo.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
  persistirErroServer(error);
}

async function persistirErroServer(error: unknown) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    await supabaseAdmin.from("erros_app").insert({
      origem: "server",
      mensagem: err.message.slice(0, 2000),
      stack: err.stack?.slice(0, 4000) ?? null,
    });
  } catch {
    // Nunca deixa o log de erro derrubar o handler de erro.
  }
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
