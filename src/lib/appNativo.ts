import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";
import { caminhoSeguro, lerRetornoDoApp, URL_RETORNO_GOOGLE } from "@/lib/linkDoApp";

// Login dentro do app Android (AND-09). A regra pura mora em lib/linkDoApp.ts;
// aqui fica o que fala com o Capacitor (navegador do celular e o evento de
// "o app foi aberto por um link") e com o Supabase.

const DESTINO_KEY = "polia-app-destino-google";

/**
 * "Entrar com Google" dentro do app: o Google bloqueia login em WebView
 * (403 disallowed_useragent), então a página dele abre no navegador do
 * celular, por cima do app. A volta chega pelo esquema do app e é tratada em
 * ouvirLinksDoApp. Devolve false se nem deu pra começar (aí a tela avisa).
 */
export async function entrarComGoogleNoApp(destino: string): Promise<boolean> {
  try {
    sessionStorage.setItem(DESTINO_KEY, caminhoSeguro(destino) ?? "/hoje");
  } catch {
    // Sem sessionStorage, a volta cai no destino padrão.
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: URL_RETORNO_GOOGLE, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return false;
  await Browser.open({ url: data.url, presentationStyle: "popover" });
  return true;
}

function destinoGuardado(): string {
  try {
    const v = sessionStorage.getItem(DESTINO_KEY);
    sessionStorage.removeItem(DESTINO_KEY);
    return caminhoSeguro(v) ?? "/hoje";
  } catch {
    return "/hoje";
  }
}

export interface AvisosDoRetorno {
  navegar: (caminho: string) => void;
  erro: (mensagem: string) => void;
}

/**
 * Liga o ouvinte de "o app foi aberto por um link" (uma vez, no layout raiz).
 * Volta do Google: grava a sessão, fecha o navegador e vai pro destino.
 * Link do nosso domínio (App Link do e-mail): a WebView vai pro caminho.
 * Fora do app não faz nada. Devolve a função que desliga o ouvinte.
 */
export function ouvirLinksDoApp(avisos: AvisosDoRetorno): () => void {
  if (!isNativeApp()) return () => {};
  const tratar = async ({ url }: URLOpenListenerEvent) => {
    const r = lerRetornoDoApp(url);
    if (r.tipo === "ignorar") return;
    if (r.tipo === "caminho") {
      avisos.navegar(r.caminho);
      return;
    }
    // Daqui pra baixo é a volta do Google: o navegador do celular sai da frente.
    await Browser.close().catch(() => {});
    if (r.tipo === "cancelado") {
      avisos.navegar("/auth/login?motivo=entrada-cancelada");
      return;
    }
    if (r.tipo === "erro") {
      avisos.erro("O Google não terminou a entrada. Tenta de novo ou entra com e-mail e senha.");
      return;
    }
    const { error } = await supabase.auth.setSession({
      access_token: r.accessToken,
      refresh_token: r.refreshToken,
    });
    if (error) {
      avisos.erro("A Pólia não conseguiu entrar com o Google agora. Tenta de novo.");
      return;
    }
    avisos.navegar(destinoGuardado());
  };
  const assinatura = App.addListener("appUrlOpen", (e) => void tratar(e));
  return () => {
    void assinatura.then((a) => a.remove());
  };
}
