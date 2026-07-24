import { createClient } from "npm:@supabase/supabase-js@2";

// Renovação semanal do token de longa duração do Instagram (@usepolia), via
// pg_cron (segunda-feira). Fluxo "Instagram API with Facebook Login": o token
// de página de longa duração se renova trocando o atual por um novo com o
// mesmo prazo (~60 dias), usando App ID + App Secret do app na Meta for
// Developers. Guarda o resultado em integracao_instagram (não em secret de
// função — o valor muda toda semana, tabela é o lugar certo).
//
// Falhou: dispara e-mail pra Sil via Resend (ela precisa renovar na mão antes
// que a conexão vença). Sem token configurado ainda (pré-requisito do Meta
// pendente): não faz nada, silenciosamente — não é falha, é "ainda não chegamos lá".

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SOCIAL_CRON_SECRET = Deno.env.get("SOCIAL_CRON_SECRET") ?? "";
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const GRAPH = "https://graph.facebook.com/v23.0";
const EMAIL_SIL = "oi@usepolia.com.br";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function autenticado(req: Request): boolean {
  if (!SOCIAL_CRON_SECRET) return false;
  return req.headers.get("x-social-cron-secret") === SOCIAL_CRON_SECRET;
}

async function avisarFalha(motivo: string) {
  if (!RESEND_API_KEY) {
    console.error("[social-token-renovar] Missing RESEND_API_KEY — aviso não enviado.", motivo);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: [EMAIL_SIL],
        subject: "A renovação do token do Instagram falhou",
        text: `A renovação automática do token do @usepolia falhou. Motivo: ${motivo}\n\nRenova na mão no painel da Meta for Developers antes que a conexão vença.`,
        html: `<p>A renovação automática do token do @usepolia falhou.</p><p>Motivo: ${motivo}</p><p>Renova na mão no painel da Meta for Developers antes que a conexão vença.</p>`,
      }),
    });
  } catch (err) {
    console.error("[social-token-renovar] Erro ao enviar e-mail de falha:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!autenticado(req)) return new Response("Unauthorized", { status: 401 });

  const { data: atual } = await supabaseAdmin
    .from("integracao_instagram")
    .select("access_token")
    .eq("id", 1)
    .maybeSingle();

  if (!atual?.access_token) {
    return new Response(JSON.stringify({ skipped: true, motivo: "Nenhum token configurado ainda" }), { status: 200 });
  }
  if (!META_APP_ID || !META_APP_SECRET) {
    console.error("[social-token-renovar] Faltam META_APP_ID/META_APP_SECRET.");
    return new Response(JSON.stringify({ skipped: true, motivo: "META_APP_ID/META_APP_SECRET não configurados" }), {
      status: 200,
    });
  }

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: atual.access_token,
  });

  try {
    const resp = await fetch(`${GRAPH}/oauth/access_token?${params}`);
    const json = await resp.json();
    if (json.error || !json.access_token) {
      const motivo = json.error?.message ?? "Resposta sem access_token";
      await avisarFalha(motivo);
      return new Response(JSON.stringify({ ok: false, motivo }), { status: 200 });
    }

    const expiraEm = new Date(Date.now() + (json.expires_in ?? 60 * 24 * 60 * 60) * 1000).toISOString();
    await supabaseAdmin
      .from("integracao_instagram")
      .update({ access_token: json.access_token, expira_em: expiraEm, atualizado_em: new Date().toISOString() })
      .eq("id", 1);

    return new Response(JSON.stringify({ ok: true, expira_em: expiraEm }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const motivo = String(err);
    await avisarFalha(motivo);
    return new Response(JSON.stringify({ ok: false, motivo }), { status: 200 });
  }
});
