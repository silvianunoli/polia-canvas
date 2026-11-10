// Foto do post que o TikTok baixa (ONE-156): GET /api/redes/midia/{token}.
//
// O TikTok só aceita foto por PULL_FROM_URL, e só de um prefixo verificado no
// portal dele. O bucket redes-midias é privado e mora no domínio do Supabase,
// que não dá pra verificar, então a foto sai daqui, no domínio da Pólia. A
// única porta é o token de 64 caracteres que o publicador grava na mídia na
// hora de enviar e apaga quando o post termina; vale 2 horas.
//
// Roda no Worker antes do TanStack Start (src/server.ts), como o download do
// manual: é arquivo, não tela. Só JPEG, que é o que a tela de post grava.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tokenMidiaValido } from "../../supabase/functions/_shared/redesPublicar.ts";

export const PREFIXO_MIDIA_REDES = "/api/redes/midia/";

const naoAchou = () =>
  new Response("Não encontrado", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

export async function responderMidiaRedes(request: Request, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return naoAchou();
  const token = url.pathname.slice(PREFIXO_MIDIA_REDES.length);
  if (!tokenMidiaValido(token)) return naoAchou();

  const { data, error } = await supabaseAdmin
    .from("redes_post_midias" as never)
    .select("caminho, mime, publico_ate")
    .eq("publico_token", token)
    .maybeSingle();
  const m = data as unknown as { caminho: string; mime: string; publico_ate: string | null } | null;
  if (error || !m || m.mime !== "image/jpeg") return naoAchou();
  if (!m.publico_ate || Date.parse(m.publico_ate) < Date.now()) return naoAchou();

  const { data: arquivo, error: e2 } = await supabaseAdmin.storage
    .from("redes-midias")
    .download(m.caminho);
  if (e2 || !arquivo) return naoAchou();

  return new Response(request.method === "HEAD" ? null : arquivo, {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(arquivo.size),
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
