import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { consumirOrigemDoOAuth } from "@/lib/origemCampanha";

// Volta do login pelo Google: grava na conta a origem de campanha que o
// /auth/cadastro guardou antes de sair pro OAuth (ver origemCampanha.ts).
// Separado de origemCampanha.ts pra aquele módulo continuar puro e testável
// sem cliente do Supabase.

const JANELA_CONTA_NOVA_MS = 30 * 60 * 1000;

export async function gravarOrigemDoOAuth(): Promise<void> {
  const origem = consumirOrigemDoOAuth();
  if (!origem) return;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Não sobrescreve origem já gravada e não marca conta antiga que só entrou
    // pelo Google a partir de uma landing: a origem é de quem nasceu ali.
    if (user.user_metadata?.origem_campanha) return;
    if (Date.now() - new Date(user.created_at).getTime() > JANELA_CONTA_NOVA_MS) return;
    await supabase.auth.updateUser({ data: { origem_campanha: origem } });
    track("cadastro_origem_gravada", { metodo: "google", ...origem });
  } catch {
    // Falha aqui só deixa a conta sem origem; nunca atrapalha a entrada.
  }
}
