import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import {
  MSG_RECONECTAR_ML,
  tokenComTrava,
  type RpcBanco,
} from "../../supabase/functions/_shared/mercadoLivreAcesso.ts";
import { renovarTokens } from "./mercadoLivreApi";

// Acesso à conta conectada do Mercado Livre no Worker (Fase 3c, VND-30). A regra
// da renovação travada mora em _shared/mercadoLivreAcesso.ts, a mesma do ml-sync.

export { chaveTravaToken } from "../../supabase/functions/_shared/mercadoLivreAcesso.ts";

export type AcessoMercadoLivre = { conexaoId: string; accessToken: string; vendedoraId: string };

const rpc: RpcBanco = (nome, args) => supabaseAdmin.rpc(nome as never, args as never);

async function marcarErro(conexaoId: string, motivo: string) {
  await supabaseAdmin
    .from("canal_conexoes" as never)
    .update({
      status: "erro",
      ultimo_erro: MSG_RECONECTAR_ML,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", conexaoId);
  registrarEventoSistema({
    tipo: "integration_failure",
    origem: "mercadoLivreAcesso.server",
    servico: "mercado_livre",
    detalhes: { motivo },
  });
}

export async function obterAcessoMercadoLivre(
  userId: string,
  opcoes: { agora?: () => number; esperar?: (ms: number) => Promise<void> } = {},
): Promise<{ acesso: AcessoMercadoLivre | null; error: string | null }> {
  const { data: conexao } = await supabaseAdmin
    .from("canal_conexoes" as never)
    .select("id, status, shop_id")
    .eq("user_id", userId)
    .eq("canal", "mercado_livre")
    .maybeSingle();
  const c = conexao as unknown as { id: string; status: string; shop_id: string | null } | null;
  if (!c || c.status !== "conectada" || !c.shop_id)
    return { acesso: null, error: "O Mercado Livre não está conectado." };

  const { accessToken, error } = await tokenComTrava(c.id, {
    rpc,
    renovar: renovarTokens,
    marcarErro,
    ...opcoes,
  });
  if (!accessToken) return { acesso: null, error };
  return { acesso: { conexaoId: c.id, accessToken, vendedoraId: c.shop_id }, error: null };
}
