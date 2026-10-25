import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEventoSistema } from "@/lib/founder-eventos.server";
import { renovarTokens } from "./mercadoLivreApi";

// Acesso à conta conectada do Mercado Livre (Fase 3c, VND-30). O token de acesso
// vale 6 horas e o de renovação é de USO ÚNICO: duas renovações ao mesmo tempo
// derrubam a conexão (a segunda usa um token que a primeira já gastou).
//
// Por isso toda renovação passa pela trava canal_sync_travas (a mesma do
// tiktok-sync), com a chave da conexão: quem pega renova e grava; quem não pega
// espera o token novo aparecer. O ml-sync da 3c.3 usa a mesma chave.

const MARGEM_MS = 10 * 60 * 1000;
const TRAVA_SEGUNDOS = 30;
const ESPERAS = 5;
const MSG_RECONECTAR = "A autorização do Mercado Livre venceu. Conecta de novo.";
const MSG_OCUPADO = "O Mercado Livre está renovando o acesso. Tenta de novo em instantes.";

export type AcessoMercadoLivre = { conexaoId: string; accessToken: string; vendedoraId: string };

type TokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_expira_em: string | null;
};

/** Chave da trava de renovação de uma conexão (mesma no Worker e no ml-sync). */
export const chaveTravaToken = (conexaoId: string) => `ml_token:${conexaoId}`;

async function lerToken(conexaoId: string): Promise<TokenRow | null> {
  const { data } = await supabaseAdmin.rpc(
    "canal_token_ler" as never,
    {
      p_conexao_id: conexaoId,
    } as never,
  );
  return ((data as unknown as TokenRow[] | null) ?? [])[0] ?? null;
}

const valido = (t: TokenRow | null, agora: number) =>
  !!t?.access_token &&
  (t.access_expira_em ? Date.parse(t.access_expira_em) : 0) - agora > MARGEM_MS;

async function marcarErro(conexaoId: string, motivo: string, agora: number) {
  await supabaseAdmin
    .from("canal_conexoes" as never)
    .update({
      status: "erro",
      ultimo_erro: MSG_RECONECTAR,
      updated_at: new Date(agora).toISOString(),
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
  const agora = opcoes.agora ?? Date.now;
  const esperar = opcoes.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  const { data: conexao } = await supabaseAdmin
    .from("canal_conexoes" as never)
    .select("id, status, shop_id")
    .eq("user_id", userId)
    .eq("canal", "mercado_livre")
    .maybeSingle();
  const c = conexao as unknown as { id: string; status: string; shop_id: string | null } | null;
  if (!c || c.status !== "conectada" || !c.shop_id)
    return { acesso: null, error: "O Mercado Livre não está conectado." };
  const montar = (accessToken: string) => ({
    acesso: { conexaoId: c.id, accessToken, vendedoraId: c.shop_id! },
    error: null,
  });

  let token = await lerToken(c.id);
  if (!token?.access_token || !token.refresh_token) return { acesso: null, error: MSG_RECONECTAR };
  if (valido(token, agora())) return montar(token.access_token);

  const chave = chaveTravaToken(c.id);
  const { data: pegou } = await supabaseAdmin.rpc(
    "pegar_trava_sync" as never,
    {
      p_canal: chave,
      p_segundos: TRAVA_SEGUNDOS,
    } as never,
  );
  if (!pegou) {
    // Outra chamada está renovando: espera o token novo, sem gastar o de renovação.
    for (let i = 0; i < ESPERAS; i++) {
      await esperar(1000);
      token = await lerToken(c.id);
      if (valido(token, agora())) return montar(token!.access_token!);
    }
    return { acesso: null, error: MSG_OCUPADO };
  }

  try {
    // Pode ter terminado uma renovação entre a primeira leitura e a trava.
    token = await lerToken(c.id);
    if (valido(token, agora())) return montar(token!.access_token!);
    if (!token?.refresh_token) return { acesso: null, error: MSG_RECONECTAR };

    const { tokens, recusado } = await renovarTokens(token.refresh_token);
    if (!tokens) {
      if (recusado) {
        await marcarErro(c.id, "refresh_token_recusado", agora());
        return { acesso: null, error: MSG_RECONECTAR };
      }
      return { acesso: null, error: "A Pólia One não conseguiu falar com o Mercado Livre agora." };
    }

    // O token de renovação antigo já morreu: o par novo PRECISA ser gravado.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { error } = await supabaseAdmin.rpc(
        "canal_token_salvar" as never,
        {
          p_conexao_id: c.id,
          p_access: tokens.accessToken,
          p_refresh: tokens.refreshToken,
          p_access_expira: tokens.accessExpiraEm,
          p_refresh_expira: null,
        } as never,
      );
      if (!error) return montar(tokens.accessToken);
    }
    await marcarErro(c.id, "token_novo_nao_salvo", agora());
    return { acesso: null, error: MSG_RECONECTAR };
  } finally {
    await supabaseAdmin.rpc("soltar_trava_sync" as never, { p_canal: chave } as never);
  }
}
