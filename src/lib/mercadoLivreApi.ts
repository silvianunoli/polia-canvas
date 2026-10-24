// Cliente Mercado Livre (OAuth + API) — roda só no servidor.
// Requer MERCADO_LIVRE_CLIENT_ID / _CLIENT_SECRET / _REDIRECT_URI no ambiente:
// .env em dev, secret do Worker em prod. O secret NUNCA tem prefixo VITE_.
// Regras puras (PKCE, status, aviso) em supabase/functions/_shared/mercadoLivre.ts.

import { desafioPkce, urlDeAutorizacao } from "../../supabase/functions/_shared/mercadoLivre.ts";
import {
  lerVendedoraMl,
  pedirTokenMl,
} from "../../supabase/functions/_shared/mercadoLivreCliente.ts";

function credenciais() {
  const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
  const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
  const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

const SEM_CONFIG = "A integração com o Mercado Livre ainda não está configurada.";

/** Só o booleano sai daqui: a tela esconde o Mercado Livre quando faltar variável. */
export function mercadoLivreConfigurado(): boolean {
  return credenciais() !== null;
}

export async function montarUrlAutorizacao(
  state: string,
  verificador: string,
): Promise<{ url: string | null; error: string | null }> {
  const cred = credenciais();
  if (!cred) return { url: null, error: SEM_CONFIG };
  return {
    url: urlDeAutorizacao({
      clientId: cred.clientId,
      redirectUri: cred.redirectUri,
      state,
      desafio: await desafioPkce(verificador),
    }),
    error: null,
  };
}

export async function trocarCodigoPorTokens(code: string, verificador: string) {
  const cred = credenciais();
  if (!cred) return { tokens: null, error: SEM_CONFIG };
  return pedirTokenMl(cred, {
    grant: "authorization_code",
    code,
    verificador,
    redirectUri: cred.redirectUri,
  });
}

export const lerVendedora = lerVendedoraMl;
