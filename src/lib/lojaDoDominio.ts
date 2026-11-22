// De qual loja e domínio é esta visita (ONE-221). No servidor, pelos cabeçalhos
// que o Worker-porta do domínio próprio manda; no navegador, pelo endereço da
// barra (domínio que não é da Pólia) mais a meta que a página da loja leva.
// Fora disso, null: a loja abre em one.usepolia.com.br/loja/<endereço> como sempre.
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  CABECALHO_LOJA_DOMINIO,
  CABECALHO_LOJA_SLUG,
  META_LOJA_SLUG,
  lojaDoDominioValida,
  urlNoDominio,
  type LojaDoDominio,
} from "@/lib/lojaDominio";
import { urlCanonica } from "@/lib/seo";

export const lojaDoDominio = createIsomorphicFn()
  .server((): LojaDoDominio | null => {
    try {
      return lojaDoDominioValida(
        getRequestHeader(CABECALHO_LOJA_SLUG),
        getRequestHeader(CABECALHO_LOJA_DOMINIO),
      );
    } catch {
      // Fora de um pedido (ex.: na carga do módulo): não é visita de domínio próprio.
      return null;
    }
  })
  .client((): LojaDoDominio | null => {
    const slug = document.querySelector(`meta[name="${META_LOJA_SLUG}"]`)?.getAttribute("content");
    return lojaDoDominioValida(slug, window.location.hostname);
  });

/** URL pública (canonical, og:url) de um caminho da loja, no domínio certo. */
export function urlPublicaDaLoja(caminho: string): string {
  const loja = lojaDoDominio();
  return loja ? urlNoDominio(caminho, loja) : urlCanonica(caminho);
}
