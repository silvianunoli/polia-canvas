// Entrega do PDF do manual pelo link com token (/manual/baixar?t=...).
//
// Roda no Worker, antes do roteamento do TanStack Start (ver src/server.ts),
// porque a resposta é um arquivo, não uma tela. O PDF mora num bucket PRIVADO
// do Supabase Storage (migration 20260914130000), não em public/ do app: o
// servidor de assets do Cloudflare entrega o que está em public/ antes do
// Worker rodar, e isso faria do PDF um link público. Aqui a única porta é
// esta função, que só abre pra token que existe em manual_leads e lê o
// arquivo com o service role.
//
// Falha nunca vira página em branco: qualquer problema devolve a pessoa pra
// landing com um aviso, onde ela pede o manual de novo. Quem clicou num link
// de e-mail não tem outro lugar pra onde ir.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BUCKET_MATERIAIS,
  OBJETO_PDF,
  montarCabecalhosDownload,
  tokenDownloadValido,
} from "./download";

export type MotivoAviso = "link" | "erro";

function voltarPraLanding(origin: string, motivo: MotivoAviso): Response {
  const destino = new URL("/manual", origin);
  destino.searchParams.set("aviso", motivo);
  return Response.redirect(destino.toString(), 303);
}

export async function responderDownloadManual(url: URL): Promise<Response> {
  const token = url.searchParams.get("t");
  if (!tokenDownloadValido(token)) return voltarPraLanding(url.origin, "link");

  const { data: lead, error } = await supabaseAdmin
    .from("manual_leads")
    .select("id, downloads")
    .eq("download_token", token)
    .maybeSingle();

  if (error) {
    console.error("[Manual] Falha ao buscar o token de download:", error);
    return voltarPraLanding(url.origin, "erro");
  }
  // Token bem formado que não existe cai aqui. A landing trata igual ao
  // malformado, sem dizer qual dos dois foi: confirmar que um token é
  // inválido já é informação.
  if (!lead) return voltarPraLanding(url.origin, "link");

  const { data: arquivo, error: erroArquivo } = await supabaseAdmin.storage
    .from(BUCKET_MATERIAIS)
    .download(OBJETO_PDF);
  if (erroArquivo || !arquivo) {
    console.error("[Manual] Falha ao ler o PDF no Storage:", erroArquivo);
    return voltarPraLanding(url.origin, "erro");
  }

  // Contagem best-effort: o arquivo já vai sair, e uma falha aqui não pode
  // segurar a entrega.
  const { error: erroContagem } = await supabaseAdmin
    .from("manual_leads")
    .update({ baixado_em: new Date().toISOString(), downloads: lead.downloads + 1 })
    .eq("id", lead.id);
  if (erroContagem) console.error("[Manual] Falha ao registrar o download:", erroContagem);

  return new Response(arquivo, { status: 200, headers: montarCabecalhosDownload() });
}
