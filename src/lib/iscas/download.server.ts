// Entrega do PDF de uma isca pelo link com token (/materiais/<slug>/baixar?t=...).
//
// Mesmo desenho de src/lib/manual/download.server.ts: roda no Worker antes do
// roteamento do TanStack Start (ver src/server.ts), só abre pra token que
// existe em isca_leads E pertence ao slug do caminho, e lê o arquivo do bucket
// privado `iscas` com o service role.
//
// Falha nunca vira página em branco: qualquer problema devolve a pessoa pra
// página da isca com um aviso, onde ela pede o material de novo.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buscarIsca } from "./catalogo";
import { BUCKET_ISCAS, montarCabecalhosDownloadIsca, tokenDownloadValido } from "./download";

export type MotivoAvisoIsca = "link" | "erro";

function voltarPraPagina(origin: string, slug: string, motivo: MotivoAvisoIsca): Response {
  const destino = new URL(`/materiais/${slug}`, origin);
  destino.searchParams.set("aviso", motivo);
  return Response.redirect(destino.toString(), 303);
}

export async function responderDownloadIsca(url: URL, slug: string): Promise<Response> {
  const isca = buscarIsca(slug);
  // Slug fora do catálogo: a página dele é o 404 amigável.
  if (!isca) return Response.redirect(new URL(`/materiais/${slug}`, url.origin).toString(), 303);

  const token = url.searchParams.get("t");
  if (!tokenDownloadValido(token)) return voltarPraPagina(url.origin, slug, "link");

  const { data: lead, error } = await supabaseAdmin
    .from("isca_leads")
    .select("id, downloads")
    .eq("download_token", token)
    .eq("isca_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[Iscas] Falha ao buscar o token de download:", error);
    return voltarPraPagina(url.origin, slug, "erro");
  }
  // Token inexistente, ou de outra isca: mesma resposta, sem dizer qual foi.
  if (!lead) return voltarPraPagina(url.origin, slug, "link");

  const { data: arquivo, error: erroArquivo } = await supabaseAdmin.storage
    .from(BUCKET_ISCAS)
    .download(isca.objeto);
  if (erroArquivo || !arquivo) {
    console.error("[Iscas] Falha ao ler o PDF no Storage:", erroArquivo);
    return voltarPraPagina(url.origin, slug, "erro");
  }

  // Contagem best-effort: o arquivo já vai sair.
  const { error: erroContagem } = await supabaseAdmin
    .from("isca_leads")
    .update({ baixado_em: new Date().toISOString(), downloads: lead.downloads + 1 })
    .eq("id", lead.id);
  if (erroContagem) console.error("[Iscas] Falha ao registrar o download:", erroContagem);

  return new Response(arquivo, {
    status: 200,
    headers: montarCabecalhosDownloadIsca(isca.nomeArquivo),
  });
}
