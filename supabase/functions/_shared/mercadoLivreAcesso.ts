// Token válido de uma conexão do Mercado Livre (Fase 3c, VND-30), usado pelo
// Worker (src/lib/mercadoLivreAcesso.server.ts) e pelo ml-sync. Sem cliente
// próprio: quem chama passa a RPC do banco, a renovação e o que fazer em erro.
//
// O token de acesso vale 6 horas e o de renovação é de USO ÚNICO: duas
// renovações ao mesmo tempo derrubam a conexão (a segunda usa um token que a
// primeira já gastou). Por isso toda renovação passa pela trava
// canal_sync_travas com a chave da conexão: quem pega renova e grava; quem não
// pega espera o token novo aparecer.

import type { TokensMl } from "./mercadoLivre.ts";

const MARGEM_MS = 10 * 60 * 1000;
const TRAVA_SEGUNDOS = 30;
const ESPERAS = 5;
export const MSG_RECONECTAR_ML = "A autorização do Mercado Livre venceu. Conecta de novo.";
const MSG_OCUPADO = "O Mercado Livre está renovando o acesso. Tenta de novo em instantes.";

type TokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_expira_em: string | null;
};

export type RpcBanco = (
  nome: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export interface DependenciasAcesso {
  rpc: RpcBanco;
  renovar: (refreshToken: string) => Promise<{ tokens: TokensMl | null; recusado: boolean }>;
  /** Conexão vira "erro" e o card pede para conectar de novo. */
  marcarErro: (conexaoId: string, motivo: string) => Promise<void>;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
}

/** Chave da trava de renovação de uma conexão (mesma no Worker e no ml-sync). */
export const chaveTravaToken = (conexaoId: string) => `ml_token:${conexaoId}`;

export async function tokenComTrava(
  conexaoId: string,
  deps: DependenciasAcesso,
): Promise<{ accessToken: string | null; error: string | null }> {
  const agora = deps.agora ?? Date.now;
  const esperar = deps.esperar ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const lerToken = async (): Promise<TokenRow | null> => {
    const { data } = await deps.rpc("canal_token_ler", { p_conexao_id: conexaoId });
    return ((data as TokenRow[] | null) ?? [])[0] ?? null;
  };
  const valido = (t: TokenRow | null) =>
    !!t?.access_token &&
    (t.access_expira_em ? Date.parse(t.access_expira_em) : 0) - agora() > MARGEM_MS;
  const ok = (accessToken: string) => ({ accessToken, error: null });
  const falha = (error: string) => ({ accessToken: null, error });

  let token = await lerToken();
  if (!token?.access_token || !token.refresh_token) return falha(MSG_RECONECTAR_ML);
  if (valido(token)) return ok(token.access_token);

  const chave = chaveTravaToken(conexaoId);
  const { data: pegou } = await deps.rpc("pegar_trava_sync", {
    p_canal: chave,
    p_segundos: TRAVA_SEGUNDOS,
  });
  if (pegou !== true) {
    // Outra chamada está renovando: espera o token novo, sem gastar o de renovação.
    for (let i = 0; i < ESPERAS; i++) {
      await esperar(1000);
      token = await lerToken();
      if (valido(token)) return ok(token!.access_token!);
    }
    return falha(MSG_OCUPADO);
  }

  try {
    // Pode ter terminado uma renovação entre a primeira leitura e a trava.
    token = await lerToken();
    if (valido(token)) return ok(token!.access_token!);
    if (!token?.refresh_token) return falha(MSG_RECONECTAR_ML);

    const { tokens, recusado } = await deps.renovar(token.refresh_token);
    if (!tokens) {
      if (recusado) {
        await deps.marcarErro(conexaoId, "refresh_token_recusado");
        return falha(MSG_RECONECTAR_ML);
      }
      return falha("A Pólia One não conseguiu falar com o Mercado Livre agora.");
    }

    // O token de renovação antigo já morreu: o par novo PRECISA ser gravado.
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { error } = await deps.rpc("canal_token_salvar", {
        p_conexao_id: conexaoId,
        p_access: tokens.accessToken,
        p_refresh: tokens.refreshToken,
        p_access_expira: tokens.accessExpiraEm,
        p_refresh_expira: null,
      });
      if (!error) return ok(tokens.accessToken);
    }
    await deps.marcarErro(conexaoId, "token_novo_nao_salvo");
    return falha(MSG_RECONECTAR_ML);
  } finally {
    await deps.rpc("soltar_trava_sync", { p_canal: chave });
  }
}
