import { reais, type LojaPublica } from "@/lib/loja";
import { urlCanonica } from "@/lib/seo";

/** O que o loader de /loja/$slug devolve (mesmo desenho do /l/$slug). */
export type LeituraLoja = { ok: true; loja: LojaPublica } | { ok: false; motivo: "nao_existe" | "rede" };

export const ROTA_LOJA = "/loja/$slug";

/** A loja carregada pelo layout, lida de dentro do head() de uma rota filha. */
export function lojaDosMatches(matches: ReadonlyArray<{ routeId: string; loaderData?: unknown }>): LojaPublica | null {
  const m = matches.find((x) => x.routeId === ROTA_LOJA);
  const leitura = m?.loaderData as LeituraLoja | undefined;
  return leitura?.ok ? leitura.loja : null;
}

/** Fontes da vitrine (do modelo do Lab): Lora nos títulos, Inter no corpo. */
export const FONTES_VITRINE =
  "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600&display=swap";

/**
 * Meta de compartilhamento da loja: a prévia no WhatsApp e no Instagram tem
 * que ser da marca da cliente, não da Pólia (o root põe a da Pólia).
 */
export function metaDaLoja(p: {
  titulo: string;
  descricao: string;
  imagem: string | null;
  caminho: string;
  indexar: boolean;
  marca: string;
}) {
  const url = urlCanonica(p.caminho);
  return [
    { title: p.titulo },
    { name: "description", content: p.descricao },
    ...(p.indexar ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
    { property: "og:title", content: p.titulo },
    { property: "og:description", content: p.descricao },
    { property: "og:site_name", content: p.marca },
    { property: "og:url", content: url },
    { property: "og:image", content: p.imagem ?? "" },
    { name: "twitter:title", content: p.titulo },
    { name: "twitter:description", content: p.descricao },
    { name: "twitter:image", content: p.imagem ?? "" },
  ];
}

/** Descrição curta da loja (chamada e subchamada, ou uma frase neutra). */
export function descricaoDaLoja(loja: LojaPublica): string {
  const base = [loja.chamada, loja.subchamada].filter(Boolean).join(". ");
  return (base || `Produtos de ${loja.nome}. Escolha, monte o pedido e confirme pelo site.`).slice(0, 200);
}

export function descricaoDoProduto(nome: string, descricao: string | null, preco: number): string {
  const d = descricao?.trim().replace(/\s+/g, " ");
  return (d ? `${d} ${reais(preco)}.` : `${nome} por ${reais(preco)}.`).slice(0, 200);
}
