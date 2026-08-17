import { createClient } from "npm:@supabase/supabase-js@2";
import { emailPolia, escapeHtml } from "../_shared/email-polia.ts";

// Renovação semanal do token de longa duração do Instagram (@usepolia), via
// pg_cron (segunda-feira). Fluxo "Instagram API with Instagram Login": o
// token de usuário do Instagram (IGAA...) se renova via GET em
// graph.instagram.com/refresh_access_token com grant_type=ig_refresh_token —
// não usa App ID/Secret nem o endpoint do Facebook (diferente do fluxo de
// Página). Guarda o resultado em contas_instagram_credenciais (não em secret
// de função — o valor muda toda semana, tabela é o lugar certo).
//
// Só funciona em token com mais de 24h de vida e ainda não vencido — se
// vencer antes da renovação semanal rodar, precisa reconectar na mão.
//
// Falhou: dispara e-mail pra Sil via Resend (ela precisa renovar na mão antes
// que a conexão vença). Sem token configurado ainda (pré-requisito do Meta
// pendente): não faz nada, silenciosamente — não é falha, é "ainda não chegamos lá".

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SOCIAL_CRON_SECRET = Deno.env.get("SOCIAL_CRON_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const GRAPH = "https://graph.instagram.com";
const EMAIL_SIL = "oi@usepolia.com.br";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function autenticado(req: Request): boolean {
  if (!SOCIAL_CRON_SECRET) return false;
  return req.headers.get("x-social-cron-secret") === SOCIAL_CRON_SECRET;
}

async function avisarFalha(nomeConta: string, handle: string, motivo: string) {
  if (!RESEND_API_KEY) {
    console.error(
      "[social-token-renovar] Missing RESEND_API_KEY — aviso não enviado.",
      nomeConta,
      motivo,
    );
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: [EMAIL_SIL],
        subject: `A renovação do token do Instagram falhou (${nomeConta})`,
        text: `A renovação automática do token de @${handle} (${nomeConta}) falhou. Motivo: ${motivo}\n\nRenova na mão no painel da Meta for Developers antes que a conexão vença.`,
        // O `motivo` carrega a mensagem de erro devolvida pela Meta, que é
        // texto externo — escapa antes de entrar no HTML.
        html: emailPolia({
          preheader: `O token de @${handle} não renovou.`,
          headline: "A renovação do token falhou",
          paragrafos: [
            `A renovação automática do token de <strong>@${escapeHtml(handle)}</strong> (${escapeHtml(nomeConta)}) falhou.`,
            `Motivo: ${escapeHtml(motivo)}`,
            "Renova na mão no painel da Meta for Developers antes que a conexão vença.",
          ],
        }),
      }),
    });
  } catch (err) {
    console.error("[social-token-renovar] Erro ao enviar e-mail de falha:", err);
  }
}

interface ContaComCredencial {
  conta_id: string;
  access_token: string;
  nome: string;
  instagram_handle: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!autenticado(req)) return new Response("Unauthorized", { status: 401 });

  // Uma linha por conta ativa que já tem token — cada uma renova
  // independente das outras, uma conta falhando não trava as demais.
  const { data: contas, error } = await supabaseAdmin
    .from("contas_instagram_credenciais")
    .select("conta_id, access_token, contas_sociais!inner(nome, instagram_handle, ativo)")
    .eq("contas_sociais.ativo", true)
    .not("access_token", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const linhas = (contas ?? [])
    // deno-lint-ignore no-explicit-any
    .map((c: any) => ({
      conta_id: c.conta_id,
      access_token: c.access_token,
      nome: c.contas_sociais?.nome ?? "conta sem nome",
      instagram_handle: c.contas_sociais?.instagram_handle ?? "",
    }))
    .filter((c: ContaComCredencial) => Boolean(c.access_token)) as ContaComCredencial[];

  if (linhas.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, motivo: "Nenhuma conta com token configurado ainda" }),
      {
        status: 200,
      },
    );
  }

  const resultados: Array<{ conta_id: string; ok: boolean; motivo?: string; expira_em?: string }> =
    [];

  for (const conta of linhas) {
    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: conta.access_token,
    });

    try {
      const resp = await fetch(`${GRAPH}/refresh_access_token?${params}`);
      const json = await resp.json();
      if (json.error || !json.access_token) {
        const motivo = json.error?.message ?? "Resposta sem access_token";
        await avisarFalha(conta.nome, conta.instagram_handle, motivo);
        resultados.push({ conta_id: conta.conta_id, ok: false, motivo });
        continue;
      }

      const expiraEm = new Date(
        Date.now() + (json.expires_in ?? 60 * 24 * 60 * 60) * 1000,
      ).toISOString();
      await supabaseAdmin
        .from("contas_instagram_credenciais")
        .update({
          access_token: json.access_token,
          token_expira_em: expiraEm,
          atualizado_em: new Date().toISOString(),
        })
        .eq("conta_id", conta.conta_id);

      resultados.push({ conta_id: conta.conta_id, ok: true, expira_em: expiraEm });
    } catch (err) {
      const motivo = String(err);
      await avisarFalha(conta.nome, conta.instagram_handle, motivo);
      resultados.push({ conta_id: conta.conta_id, ok: false, motivo });
    }
  }

  return new Response(JSON.stringify({ processadas: resultados.length, resultados }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
