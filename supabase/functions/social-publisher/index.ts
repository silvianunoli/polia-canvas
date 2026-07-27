import { createClient } from "npm:@supabase/supabase-js@2";

// Publica no @usepolia via Instagram Graph API (fluxo de 2 passos: container ->
// publish), portado de polia-social/scripts/publicar.mjs. Disparado por
// pg_cron a cada minuto (via pg_net, ver disparar_social_publisher na
// migration). Sem verify_jwt: quem chama é o cron, não uma usuária — autenticação
// por segredo compartilhado, igual alertas-criticos.
//
// Reserva atômica: pegar_e_travar_posts_agendados() já marca 'publicando' com
// FOR UPDATE SKIP LOCKED antes desta função sequer rodar, então duas execuções
// do cron coincidindo nunca publicam o mesmo post 2x.
//
// Sem retry automático (R do handoff): erro = falhou e para. Só uma exceção,
// o teto diário da API, reagenda pro dia seguinte sozinho.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SOCIAL_CRON_SECRET = Deno.env.get("SOCIAL_CRON_SECRET") ?? "";
const META_TOKEN_ENV = Deno.env.get("META_TOKEN") ?? "";
const IG_USER_ID_ENV = Deno.env.get("IG_USER_ID") ?? "";

const GRAPH = "https://graph.instagram.com/v23.0";
const CODIGOS_TETO_DIARIO = [4, 17, 32, 613];
const CODIGO_TOKEN_VENCIDO = 190;
const TIMEOUT_PROCESSAMENTO_MS = 150_000;
const INTERVALO_POLL_MS = 5_000;
const INTERVALO_ENTRE_FRAMES_MS = 1_500;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface PostRow {
  id: string;
  tipo: string;
  caption: string;
  midias: string[];
  scheduled_at: string | null;
}

interface ErroGraphAPI {
  code?: number;
  message?: string;
}

class ErroPublicacao extends Error {
  constructor(
    message: string,
    public codigo?: number,
  ) {
    super(message);
  }
}

function autenticado(req: Request): boolean {
  if (!SOCIAL_CRON_SECRET) return false;
  return req.headers.get("x-social-cron-secret") === SOCIAL_CRON_SECRET;
}

async function obterCredenciais(): Promise<{ token: string; igUserId: string }> {
  const { data } = await supabaseAdmin
    .from("integracao_instagram")
    .select("access_token, ig_user_id")
    .eq("id", 1)
    .maybeSingle();
  return {
    token: data?.access_token || META_TOKEN_ENV,
    igUserId: data?.ig_user_id || IG_USER_ID_ENV,
  };
}

async function chamarGraphAPI(
  token: string,
  path: string,
  params: Record<string, string>,
): Promise<{ id: string }> {
  const body = new URLSearchParams({ ...params, access_token: token });
  const resp = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = await resp.json();
  if (json.error) {
    const erro = json.error as ErroGraphAPI;
    throw new ErroPublicacao(erro.message ?? "Erro desconhecido da API", erro.code);
  }
  return json;
}

async function esperarProcessamento(token: string, mediaId: string): Promise<void> {
  const inicio = Date.now();
  while (Date.now() - inicio < TIMEOUT_PROCESSAMENTO_MS) {
    const resp = await fetch(`${GRAPH}/${mediaId}?fields=status_code&access_token=${token}`);
    const json = await resp.json();
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") {
      throw new ErroPublicacao("O Instagram não processou essa mídia. Confere o arquivo e tenta de novo.");
    }
    await new Promise((r) => setTimeout(r, INTERVALO_POLL_MS));
  }
  throw new ErroPublicacao("O Instagram não processou essa mídia. Confere o arquivo e tenta de novo.");
}

async function obterPermalink(token: string, mediaId: string): Promise<string | null> {
  try {
    const resp = await fetch(`${GRAPH}/${mediaId}?fields=permalink&access_token=${token}`);
    const json = await resp.json();
    return json.permalink ?? null;
  } catch {
    return null;
  }
}

async function publicarFeed(token: string, igUserId: string, post: PostRow): Promise<string> {
  const { id } = await chamarGraphAPI(token, `${igUserId}/media`, {
    image_url: post.midias[0],
    caption: post.caption,
  });
  await esperarProcessamento(token, id);
  const pub = await chamarGraphAPI(token, `${igUserId}/media_publish`, { creation_id: id });
  return pub.id;
}

async function publicarCarrossel(token: string, igUserId: string, post: PostRow): Promise<string> {
  const filhos: string[] = [];
  for (const url of post.midias) {
    const { id } = await chamarGraphAPI(token, `${igUserId}/media`, {
      image_url: url,
      is_carousel_item: "true",
    });
    filhos.push(id);
  }
  const { id: creationId } = await chamarGraphAPI(token, `${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: filhos.join(","),
    caption: post.caption,
  });
  await esperarProcessamento(token, creationId);
  const pub = await chamarGraphAPI(token, `${igUserId}/media_publish`, { creation_id: creationId });
  return pub.id;
}

async function publicarReel(token: string, igUserId: string, post: PostRow): Promise<string> {
  const { id } = await chamarGraphAPI(token, `${igUserId}/media`, {
    media_type: "REELS",
    video_url: post.midias[0],
    caption: post.caption,
  });
  await esperarProcessamento(token, id);
  const pub = await chamarGraphAPI(token, `${igUserId}/media_publish`, { creation_id: id });
  return pub.id;
}

/** Sequência de frames: publica em ordem, PARA no primeiro que falhar (sem retry). */
async function publicarStory(token: string, igUserId: string, post: PostRow): Promise<string> {
  const idsPublicados: string[] = [];
  for (let i = 0; i < post.midias.length; i++) {
    const url = post.midias[i];
    const ehVideo = url.endsWith(".mp4");
    try {
      const { id } = await chamarGraphAPI(token, `${igUserId}/media`, {
        media_type: "STORIES",
        ...(ehVideo ? { video_url: url } : { image_url: url }),
      });
      await esperarProcessamento(token, id);
      const pub = await chamarGraphAPI(token, `${igUserId}/media_publish`, { creation_id: id });
      idsPublicados.push(pub.id);
      if (i < post.midias.length - 1) {
        await new Promise((r) => setTimeout(r, INTERVALO_ENTRE_FRAMES_MS));
      }
    } catch (err) {
      const motivo = err instanceof ErroPublicacao ? err.message : String(err);
      throw new ErroPublicacao(`parou no frame ${i + 1}: ${motivo}`, err instanceof ErroPublicacao ? err.codigo : undefined);
    }
  }
  return idsPublicados.join(",");
}

async function publicarPost(token: string, igUserId: string, post: PostRow): Promise<string> {
  switch (post.tipo) {
    case "feed":
      return publicarFeed(token, igUserId, post);
    case "carrossel":
      return publicarCarrossel(token, igUserId, post);
    case "reel":
      return publicarReel(token, igUserId, post);
    case "story":
      return publicarStory(token, igUserId, post);
    default:
      throw new ErroPublicacao(`Tipo de post desconhecido: ${post.tipo}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!autenticado(req)) return new Response("Unauthorized", { status: 401 });

  const { data: posts, error: erroReserva } = await supabaseAdmin.rpc("pegar_e_travar_posts_agendados");
  if (erroReserva) {
    return new Response(JSON.stringify({ error: erroReserva.message }), { status: 500 });
  }

  const { token, igUserId } = await obterCredenciais();
  const resultados: Array<{ id: string; status: string }> = [];

  if (!token || !igUserId) {
    // Sem credenciais configuradas ainda (pré-requisito do Meta pendente):
    // devolve os posts pra 'agendado' e não tenta publicar nada.
    for (const post of (posts ?? []) as PostRow[]) {
      await supabaseAdmin.from("social_posts").update({ status: "agendado" }).eq("id", post.id);
    }
    return new Response(JSON.stringify({ skipped: true, motivo: "META_TOKEN/IG_USER_ID não configurados" }), {
      status: 200,
    });
  }

  for (const post of (posts ?? []) as PostRow[]) {
    try {
      const igMediaId = await publicarPost(token, igUserId, post);
      const permalink = await obterPermalink(token, igMediaId.split(",")[0]);
      await supabaseAdmin
        .from("social_posts")
        .update({ status: "publicado", ig_media_id: igMediaId, permalink, erro: null })
        .eq("id", post.id);
      resultados.push({ id: post.id, status: "publicado" });
    } catch (err) {
      const erro = err instanceof ErroPublicacao ? err : new ErroPublicacao(String(err));

      if (erro.codigo && CODIGOS_TETO_DIARIO.includes(erro.codigo)) {
        const novaData = post.scheduled_at
          ? new Date(new Date(post.scheduled_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
          : new Date().toISOString();
        await supabaseAdmin
          .from("social_posts")
          .update({ status: "agendado", scheduled_at: novaData })
          .eq("id", post.id);
        resultados.push({ id: post.id, status: "reagendado_teto_diario" });
        continue;
      }

      const mensagem =
        erro.codigo === CODIGO_TOKEN_VENCIDO
          ? "A conexão com o Instagram venceu. Renova e clica em Tentar de novo."
          : erro.message;

      await supabaseAdmin.from("social_posts").update({ status: "falhou", erro: mensagem }).eq("id", post.id);
      resultados.push({ id: post.id, status: "falhou" });
    }
  }

  return new Response(JSON.stringify({ processados: resultados.length, resultados }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
