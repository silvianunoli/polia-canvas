// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response. Also
// persiste em erros_app (origem "server") — antes esse erro só existia 5s em
// memória e sumia se ninguém consumisse a tempo.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispararAlerta } from "@/lib/alertas.server";
import { sanitizarMensagemErro, sanitizarStack } from "@/lib/error-sanitize";

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
  persistirErroServer(error);
}

async function persistirErroServer(error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  // Mascara dado pessoal e corta o stack no topo antes de gravar (LGPD-03).
  // Vale também pro alerta: o Telegram é mais um lugar onde o dado ficaria.
  const mensagem = sanitizarMensagemErro(err.message);
  try {
    await supabaseAdmin.from("erros_app").insert({
      origem: "server",
      mensagem,
      stack: sanitizarStack(err.stack),
    });
  } catch {
    // Nunca deixa o log de erro derrubar o handler de erro.
  }
  void dispararAlerta("erro_servidor_critico", "Erro não tratado no servidor", {
    mensagem: mensagem.slice(0, 500),
  });
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
