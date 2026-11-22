// Vitrine online no domínio próprio da marca (ONE-221, 22/11/2026). Sil: "eu quero
// que a loja da bea seja exatamente igual as outras lojas, exceto pelo fato de que
// ela tem dominio próprio".
//
// Quem atende o domínio (ex.: lovelesscrochet.com.br) é um Worker-porta do Pólia
// Lab: ele repassa cada pedido pra cá com o caminho como veio ("/", "/<produto>")
// e dois cabeçalhos dizendo de qual loja e de qual domínio se trata. O roteador
// põe "/loja/<endereço>" na frente pra achar a rota de sempre e tira de novo ao
// montar os links, então a cliente vê só o domínio da marca. As regras puras
// moram aqui; quem lê o cabeçalho (servidor) ou a página (navegador) é
// lojaDoDominio.ts.
import { deveRedirecionarParaHostCanonico } from "@/lib/seo";

export const CABECALHO_LOJA_SLUG = "x-polia-loja-slug";
export const CABECALHO_LOJA_DOMINIO = "x-polia-loja-dominio";
/** Meta que a página da loja sempre leva: é como o navegador descobre o endereço da loja. */
export const META_LOJA_SLUG = "polia-loja";

export interface LojaDoDominio {
  slug: string;
  dominio: string;
}

const SLUG = /^[a-z0-9-]{3,40}$/;
const DOMINIO = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Só aceita o par quando os dois têm formato válido e o domínio não é da Pólia nem local. */
export function lojaDoDominioValida(slug: unknown, dominio: unknown): LojaDoDominio | null {
  if (typeof slug !== "string" || typeof dominio !== "string") return null;
  const s = slug.trim().toLowerCase();
  const d = dominio.trim().toLowerCase();
  if (!SLUG.test(s) || !DOMINIO.test(d)) return null;
  if (!deveRedirecionarParaHostCanonico(d)) return null;
  return { slug: s, dominio: d };
}

const prefixo = (slug: string) => `/loja/${slug}`;

/** Caminho que a cliente vê no domínio -> caminho da rota. "/" vira "/loja/<slug>". */
export function paraDentro(caminho: string, slug: string): string {
  const p = prefixo(slug);
  if (caminho === p || caminho.startsWith(`${p}/`)) return caminho;
  const limpo = caminho.replace(/^\/+/, "");
  return limpo ? `${p}/${limpo}` : p;
}

/** Caminho da rota -> caminho no domínio. Fora da loja, fica como está. */
export function paraFora(caminho: string, slug: string): string {
  const p = prefixo(slug);
  if (caminho === p || caminho === `${p}/`) return "/";
  if (caminho.startsWith(`${p}/`)) return caminho.slice(p.length);
  return caminho;
}

/** URL pública de um caminho da loja: no domínio da marca quando a visita veio por ele. */
export function urlNoDominio(caminho: string, loja: LojaDoDominio): string {
  return `https://${loja.dominio}${paraFora(caminho, loja.slug)}`;
}
