import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Pré-lançamento: o site público manda visitante anônimo pra
// /lista-de-espera. Quem já tem sessão (assinante paga ou admin) continua
// vendo as páginas normalmente — a trava é só pra quem ainda não é cliente,
// não pra tirar acesso de quem já paga. /pesquisa, /lista-de-espera,
// /termos, /privacidade, /ajuda e /auth/* não usam este guard — ficam
// sempre abertas.
//
// Client-only (mesmo padrão de _authenticated.tsx): a sessão só existe no
// localStorage do navegador, então SSR não tem como checar. Não é fronteira
// de segurança — as páginas aqui não têm dado sensível, só copy.
export async function gatePublico() {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/lista-de-espera" });
  }
}
