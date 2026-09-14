// Regras do link de download do manual, na parte que não precisa de rede:
// formato do token, onde o arquivo mora e cabeçalhos da resposta. Quem
// consulta o banco e busca o PDF é src/lib/manual/download.server.ts; separar
// assim deixa a régua testável sem Worker de pé.

import { urlCanonica } from "@/lib/seo";
import { NOME_ARQUIVO_PDF } from "./conteudo";

/** Rota pública que entrega o PDF (tratada em src/server.ts, antes do TanStack). */
export const CAMINHO_DOWNLOAD = "/manual/baixar";

/** Bucket PRIVADO do Supabase Storage (migration 20260914130000). O PDF não
 *  fica em public/ do app de propósito: o servidor de assets do Cloudflare
 *  entrega o que está lá antes do Worker rodar, e aí o gate de e-mail vira
 *  enfeite. No bucket privado só o service role lê. */
export const BUCKET_MATERIAIS = "materiais";
export const OBJETO_PDF = "manual-pequena-marca.pdf";

// uuid v4, que é o que gen_random_uuid() gera pra manual_leads.download_token.
// Validar o formato antes de encostar no banco evita consulta por lixo.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function tokenDownloadValido(token: string | null | undefined): token is string {
  return typeof token === "string" && UUID_V4.test(token);
}

export function ehCaminhoDeDownload(pathname: string): boolean {
  return pathname === CAMINHO_DOWNLOAD;
}

/** URL absoluta do download, pro e-mail e pra tela de "pronto". Host fixo,
 *  nunca derivado do request: o site também responde em *.workers.dev. */
export function urlDownloadManual(token: string): string {
  return `${urlCanonica(CAMINHO_DOWNLOAD)}?t=${encodeURIComponent(token)}`;
}

/** Cabeçalhos da resposta com o PDF. `attachment` faz o navegador baixar em
 *  vez de abrir na aba, `no-store` porque a resposta é por token, e noindex
 *  porque um link privado nunca deve virar resultado de busca. */
export function montarCabecalhosDownload(): Record<string, string> {
  return {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${NOME_ARQUIVO_PDF}"`,
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
  };
}
