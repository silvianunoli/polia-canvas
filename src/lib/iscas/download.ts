// Regras do link de download das iscas (/materiais/<slug>/baixar?t=...), na
// parte que não precisa de rede: formato do caminho, onde o arquivo mora e
// cabeçalhos da resposta. Quem consulta o banco e busca o PDF é
// src/lib/iscas/download.server.ts. Mesmo desenho de src/lib/manual/download.ts.

import { urlCanonica } from "@/lib/seo";
import { tokenDownloadValido } from "@/lib/manual/download";
import { SLUG_ISCA } from "./catalogo";

export { tokenDownloadValido };

/** Bucket PRIVADO do Supabase Storage (migration 20261111120000). O PDF não
 *  fica em public/ do app pelo mesmo motivo do manual: o servidor de assets do
 *  Cloudflare entrega o que está lá antes do Worker rodar, e aí o gate vira
 *  enfeite. No bucket privado só o service role lê. */
export const BUCKET_ISCAS = "iscas";

const CAMINHO = /^\/materiais\/([a-z0-9]+(?:-[a-z0-9]+)*)\/baixar\/?$/;

export function caminhoDownloadIsca(slug: string): string {
  return `/materiais/${slug}/baixar`;
}

/** Slug do caminho de download, ou null se o caminho não é de download de
 *  isca. Não confere se o slug existe no catálogo: isso é com o servidor, que
 *  devolve a pessoa pra página com aviso. */
export function slugDoDownloadDeIsca(pathname: string): string | null {
  const m = CAMINHO.exec(pathname);
  return m && SLUG_ISCA.test(m[1]) ? m[1] : null;
}

/** URL absoluta do download, pro e-mail e pra tela de "pronto". Host fixo,
 *  nunca derivado do request: o site também responde em *.workers.dev. */
export function urlDownloadIsca(slug: string, token: string): string {
  return `${urlCanonica(caminhoDownloadIsca(slug))}?t=${encodeURIComponent(token)}`;
}

/** Cabeçalhos da resposta com o PDF. Mesmos critérios do manual. */
export function montarCabecalhosDownloadIsca(nomeArquivo: string): Record<string, string> {
  // nomeArquivo vem do catálogo (código, não entrada), mas aspas e quebra de
  // linha nunca podem chegar no cabeçalho.
  const seguro = nomeArquivo.replace(/[^A-Za-z0-9._-]/g, "-");
  return {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${seguro}"`,
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
  };
}
