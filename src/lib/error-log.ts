import { supabase } from "@/integrations/supabase/client";
import { sanitizarMensagemErro, sanitizarPagina, sanitizarStack } from "@/lib/error-sanitize";

// Log persistente de erro de client (JS não tratado, promise rejeitada, ou
// capturado pelo error boundary do router). Sempre grava — diferente de
// analytics.ts, não depende de consentimento de cookies: é diagnóstico
// técnico, não comportamento de navegação.
//
// Mensagem, stack e página passam por error-sanitize antes do insert: dado
// pessoal mascarado e stack cortado no topo (LGPD-03).
export async function logErroCliente(mensagem: string, stack?: string, pagina?: string) {
  if (typeof window === "undefined") return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase.from("erros_app").insert({
      origem: "client",
      mensagem: sanitizarMensagemErro(mensagem),
      stack: sanitizarStack(stack),
      pagina: sanitizarPagina(pagina ?? window.location.pathname),
      user_id: session?.user.id ?? null,
    });
  } catch {
    // Se o log de erro falhar, não pode gerar outro erro.
  }
}
