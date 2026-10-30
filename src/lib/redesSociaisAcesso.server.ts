import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import {
  MSG_RECONECTAR,
  acessoPertoDeVencer,
  type Rede,
} from "../../supabase/functions/_shared/redesSociais.ts";
import { renovarInstagram, renovarTokenTiktok } from "./redesSociaisApi";

// Acesso à conta conectada (ONE-154): lê o token do Vault pela RPC só de
// servidor e, no TikTok, renova quando faltam menos de 5 minutos (o de acesso
// dura 24 h). No Instagram o token longo dura 60 dias e quem renova é o cron
// diário (redes-token-renovar); aqui só renova se estiver a 5 minutos do fim.
// Se a rede recusar a renovação, a conexão vira "erro" e o card pede para
// conectar de novo.

export type AcessoRede = { conexaoId: string; accessToken: string; contaId: string | null };

type TokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_expira_em: string | null;
};

async function marcarErro(conexaoId: string, rede: Rede, agora: number) {
  await supabaseAdmin
    .from("redes_conexoes" as never)
    .update({
      status: "erro",
      ultimo_erro: MSG_RECONECTAR[rede],
      updated_at: new Date(agora).toISOString(),
    } as never)
    .eq("id", conexaoId);
  registrarEventoSistema({
    tipo: "integration_failure",
    origem: "redesSociaisAcesso.server",
    servico: rede,
    detalhes: { motivo: "renovacao_recusada" },
  });
}

export async function obterAcessoRede(
  userId: string,
  rede: Rede,
  agora: number = Date.now(),
): Promise<{ acesso: AcessoRede | null; error: string | null }> {
  const { data: conexao } = await supabaseAdmin
    .from("redes_conexoes" as never)
    .select("id, status, conta_id")
    .eq("user_id", userId)
    .eq("rede", rede)
    .maybeSingle();
  const c = conexao as unknown as { id: string; status: string; conta_id: string | null } | null;
  if (!c || c.status !== "conectada")
    return {
      acesso: null,
      error: `O ${rede === "tiktok" ? "TikTok" : "Instagram"} não está conectado.`,
    };

  const { data: linhas } = await supabaseAdmin.rpc(
    "redes_token_ler" as never,
    { p_conexao_id: c.id } as never,
  );
  const token = ((linhas as unknown as TokenRow[] | null) ?? [])[0];
  if (!token?.access_token) return { acesso: null, error: MSG_RECONECTAR[rede] };

  const acesso = (accessToken: string): AcessoRede => ({
    conexaoId: c.id,
    accessToken,
    contaId: c.conta_id,
  });
  if (!acessoPertoDeVencer(token.access_expira_em, agora))
    return { acesso: acesso(token.access_token), error: null };

  if (rede === "tiktok") {
    if (!token.refresh_token) return { acesso: null, error: MSG_RECONECTAR.tiktok };
    const r = await renovarTokenTiktok(token.refresh_token);
    if (!r.valor) {
      if (r.recusado) await marcarErro(c.id, rede, agora);
      return { acesso: null, error: r.recusado ? MSG_RECONECTAR.tiktok : r.error };
    }
    const { error } = await supabaseAdmin.rpc(
      "redes_token_salvar" as never,
      {
        p_conexao_id: c.id,
        p_access: r.valor.accessToken,
        p_refresh: r.valor.refreshToken,
        p_access_expira: r.valor.accessExpiraEm,
        p_refresh_expira: r.valor.refreshExpiraEm,
      } as never,
    );
    if (error)
      return { acesso: null, error: "A Pólia One não conseguiu renovar o acesso ao TikTok." };
    return { acesso: acesso(r.valor.accessToken), error: null };
  }

  const r = await renovarInstagram(token.access_token);
  if (!r.valor) {
    if (r.recusado) await marcarErro(c.id, rede, agora);
    return { acesso: null, error: r.recusado ? MSG_RECONECTAR.instagram : r.error };
  }
  const { error } = await supabaseAdmin.rpc(
    "redes_token_salvar" as never,
    {
      p_conexao_id: c.id,
      p_access: r.valor.accessToken,
      p_refresh: null,
      p_access_expira: r.valor.accessExpiraEm,
      p_refresh_expira: null,
    } as never,
  );
  if (error)
    return { acesso: null, error: "A Pólia One não conseguiu renovar o acesso ao Instagram." };
  return { acesso: acesso(r.valor.accessToken), error: null };
}
