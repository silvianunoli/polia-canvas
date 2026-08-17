// Identidade do site pro buscador: qual é o endereço canônico e como montar
// um <link rel="canonical"> a partir de um caminho.
//
// O site responde em mais de um hostname: o domínio próprio, o www (que já
// redirecionava) e o subdomínio *.workers.dev, que fica ligado de propósito no
// wrangler.jsonc como fallback operacional. Sem canonical e sem 301, o mesmo
// conteúdo entra no índice do Google em endereços diferentes e um compete com
// o outro.

import { DOMINIO_GESTAO } from "./dominio-gestao";

export const HOST_CANONICO = "https://usepolia.com.br";
export const HOSTNAME_CANONICO = "usepolia.com.br";

/** Hostnames que servem o site de verdade e não devem ser redirecionados. */
const HOSTS_OFICIAIS = new Set([HOSTNAME_CANONICO, DOMINIO_GESTAO]);

/** Desenvolvimento local: nome reservado ou IP literal (LAN inclusive). */
const HOSTS_LOCAIS = new Set(["localhost", "0.0.0.0"]);
const IP_LITERAL = /^\d{1,3}(\.\d{1,3}){3}$|^\[/;

/**
 * URL absoluta e canônica para um caminho do site público.
 * Aceita o caminho com ou sem barra inicial e nunca devolve barra dupla.
 */
export function urlCanonica(caminho: string): string {
  const limpo = caminho.replace(/^\/+/, "");
  return limpo ? `${HOST_CANONICO}/${limpo}` : `${HOST_CANONICO}/`;
}

/** Objeto de <link rel="canonical"> pronto pro head() das rotas. */
export function linkCanonico(caminho: string): { rel: string; href: string } {
  return { rel: "canonical", href: urlCanonica(caminho) };
}

/**
 * Se o pedido chegou por um hostname que não é o oficial (www, workers.dev,
 * preview), ele vira 301 pro domínio próprio. O domínio de gestão e o
 * desenvolvimento local ficam de fora.
 */
export function deveRedirecionarParaHostCanonico(hostname: string): boolean {
  if (HOSTS_OFICIAIS.has(hostname)) return false;
  if (HOSTS_LOCAIS.has(hostname) || hostname.endsWith(".localhost")) return false;
  if (IP_LITERAL.test(hostname)) return false;
  return true;
}
