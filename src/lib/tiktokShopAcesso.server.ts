import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import { renovarTokens } from "./tiktokShopApi";

// Acesso à loja conectada (Fase 3a, VND-05): lê o token do Vault pela RPC só de
// servidor e renova quando faltam menos de 5 minutos. O token vale 7 dias; o
// refresh_token dura o tempo da autorização. Se o TikTok recusar a renovação, a
// conexão vira "erro" e o card pede para conectar de novo.

const MARGEM_MS = 5 * 60 * 1000;
const MSG_RECONECTAR = "A autorização do TikTok Shop venceu. Conecta de novo.";

export type AcessoTiktok = { conexaoId: string; accessToken: string; shopCipher: string };

type TokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_expira_em: string | null;
};

export async function obterAcessoTiktok(
  userId: string,
  agora: number = Date.now(),
): Promise<{ acesso: AcessoTiktok | null; error: string | null }> {
  const { data: conexao } = await supabaseAdmin
    .from("canal_conexoes" as never)
    .select("id, status, shop_cipher")
    .eq("user_id", userId)
    .eq("canal", "tiktok_shop")
    .maybeSingle();
  const c = conexao as unknown as { id: string; status: string; shop_cipher: string | null } | null;
  if (!c || c.status !== "conectada" || !c.shop_cipher)
    return { acesso: null, error: "O TikTok Shop não está conectado." };

  const { data: linhas } = await supabaseAdmin.rpc(
    "canal_token_ler" as never,
    {
      p_conexao_id: c.id,
    } as never,
  );
  const token = ((linhas as unknown as TokenRow[] | null) ?? [])[0];
  if (!token?.access_token || !token.refresh_token) return { acesso: null, error: MSG_RECONECTAR };

  const venceEm = token.access_expira_em ? Date.parse(token.access_expira_em) : 0;
  if (venceEm - agora > MARGEM_MS)
    return {
      acesso: { conexaoId: c.id, accessToken: token.access_token, shopCipher: c.shop_cipher },
      error: null,
    };

  const { tokens } = await renovarTokens(token.refresh_token);
  if (!tokens) {
    await supabaseAdmin
      .from("canal_conexoes" as never)
      .update({
        status: "erro",
        ultimo_erro: MSG_RECONECTAR,
        updated_at: new Date(agora).toISOString(),
      } as never)
      .eq("id", c.id);
    registrarEventoSistema({
      tipo: "integration_failure",
      origem: "tiktokShopAcesso.server",
      servico: "tiktok_shop",
      detalhes: { motivo: "refresh_token_recusado" },
    });
    return { acesso: null, error: MSG_RECONECTAR };
  }
  const { error } = await supabaseAdmin.rpc(
    "canal_token_salvar" as never,
    {
      p_conexao_id: c.id,
      p_access: tokens.accessToken,
      p_refresh: tokens.refreshToken,
      p_access_expira: tokens.accessExpiraEm,
      p_refresh_expira: tokens.refreshExpiraEm,
    } as never,
  );
  if (error)
    return { acesso: null, error: "A Pólia One não conseguiu renovar o acesso ao TikTok Shop." };
  return {
    acesso: { conexaoId: c.id, accessToken: tokens.accessToken, shopCipher: c.shop_cipher },
    error: null,
  };
}
