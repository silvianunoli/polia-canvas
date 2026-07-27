import { createClient } from "npm:@supabase/supabase-js@2";

// Puxa insights (reach, saved, shares, comments, likes) de todo post 'publicado'
// dos últimos 28 dias e faz upsert em social_metricas(post_id, dia). Disparado
// 1x/dia via pg_cron (ver disparar_social_metricas). É o que alimenta a revisão
// de 4 semanas do plano de conteúdo (handoff Seção 5).
//
// Nomes de métrica da Graph API mudam entre media_product_type — se a Meta
// alterar o contrato, os campos ausentes simplesmente ficam null (upsert
// tolerante), não quebra o job inteiro.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SOCIAL_CRON_SECRET = Deno.env.get("SOCIAL_CRON_SECRET") ?? "";
const META_TOKEN_ENV = Deno.env.get("META_TOKEN") ?? "";

const GRAPH = "https://graph.instagram.com/v23.0";
const DIAS_JANELA = 28;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function autenticado(req: Request): boolean {
  if (!SOCIAL_CRON_SECRET) return false;
  return req.headers.get("x-social-cron-secret") === SOCIAL_CRON_SECRET;
}

interface Insight {
  name: string;
  values: Array<{ value: number }>;
}

async function buscarInsights(token: string, mediaId: string): Promise<Record<string, number>> {
  const metricas = "reach,saved,shares,comments,likes";
  const resp = await fetch(`${GRAPH}/${mediaId}/insights?metric=${metricas}&access_token=${token}`);
  const json = await resp.json();
  if (json.error || !Array.isArray(json.data)) return {};
  const mapa: Record<string, number> = {};
  for (const item of json.data as Insight[]) {
    mapa[item.name] = item.values?.[0]?.value ?? 0;
  }
  return mapa;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!autenticado(req)) return new Response("Unauthorized", { status: 401 });

  const { data: cred } = await supabaseAdmin
    .from("integracao_instagram")
    .select("access_token")
    .eq("id", 1)
    .maybeSingle();
  const token = cred?.access_token || META_TOKEN_ENV;
  if (!token) {
    return new Response(JSON.stringify({ skipped: true, motivo: "META_TOKEN não configurado" }), { status: 200 });
  }

  const desde = new Date(Date.now() - DIAS_JANELA * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts, error } = await supabaseAdmin
    .from("social_posts")
    .select("id, ig_media_id")
    .eq("status", "publicado")
    .not("ig_media_id", "is", null)
    .gte("created_at", desde);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  let processados = 0;

  for (const post of posts ?? []) {
    // Story publica vários frames com IDs separados por vírgula; métrica vai
    // pro primeiro frame (aproximação — story é efêmero, insight de frame
    // isolado importa menos que o agregado do feed/carrossel/reel).
    const mediaId = (post.ig_media_id as string).split(",")[0];
    const insights = await buscarInsights(token, mediaId);

    await supabaseAdmin.from("social_metricas").upsert(
      {
        post_id: post.id,
        dia: hoje,
        reach: insights.reach ?? null,
        saves: insights.saved ?? null,
        shares: insights.shares ?? null,
        comments: insights.comments ?? null,
        likes: insights.likes ?? null,
      },
      { onConflict: "post_id,dia" },
    );
    processados++;
  }

  return new Response(JSON.stringify({ processados }), { status: 200, headers: { "Content-Type": "application/json" } });
});
