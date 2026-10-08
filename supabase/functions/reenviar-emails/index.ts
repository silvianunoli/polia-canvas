import { createClient } from "npm:@supabase/supabase-js@2";
import { montarEmailAtivacao } from "../_shared/emailAtivacao.ts";
import { MAX_TENTATIVAS, proximaTentativaEm } from "../_shared/reenvioEmail.ts";
import { mascararEmail, semEmails } from "../_shared/stripeWebhookRegras.ts";

// Fila de reenvio dos e-mails do Stripe (PAY-27, 08/10/2026). Chamada só pelo
// pg_cron (disparar_reenvio_emails(), migração 20261009000100) a cada 10 min,
// e só quando há e-mail vencido na fila. verify_jwt desligado: quem chama não
// tem sessão. O segredo do cron mora só no Vault do banco; esta função confere
// o que recebeu chamando conferir_segredo_reenvio_emails (service role), então
// o valor nunca sai do banco nem vira variável de ambiente.
//
// O que faz: pega até LOTE e-mails com proxima_tentativa vencida, tenta de
// novo pelo Resend e marca enviado_em. Falhou de novo: soma a tentativa e
// agenda a próxima (_shared/reenvioEmail.ts). Passou de MAX_TENTATIVAS: marca
// desistiu_em e dispara o alerta pra resolver à mão. O e-mail de ativação
// (regenerar_ativacao) ganha link novo a cada tentativa: o do convite expira.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERTAS_SECRET = Deno.env.get("ALERTAS_SECRET") ?? "";
const SITE_URL = "https://one.usepolia.com.br";
const ADMIN_URL = "https://office.usepolia.com.br";
const LOTE = 20;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Pendente {
  id: string;
  destinatario: string;
  assunto: string;
  texto: string;
  html: string;
  contexto: string;
  regenerar_ativacao: boolean;
  tentativas: number;
}

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-reenvio-emails-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_reenvio_emails", {
    p_segredo: recebido,
  });
  if (error) {
    console.error("[reenviar-emails] Falha ao conferir o segredo:", error);
    return false;
  }
  return data === true;
}

async function dispararAlerta(tipo: string, titulo: string, detalhes: Record<string, unknown>) {
  if (!ALERTAS_SECRET) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/alertas-criticos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-alertas-secret": ALERTAS_SECRET },
      body: JSON.stringify({ tipo, titulo, detalhes, link: `${ADMIN_URL}/qualidade` }),
    });
  } catch (err) {
    console.error("[reenviar-emails] Falha ao chamar alertas-criticos:", err);
  }
}

// Link novo pra conta que ainda não criou a senha (mesmo caminho do
// gerarLinkDeAtivacaoDeNovo do stripe-webhook).
async function linkDeAtivacaoNovo(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE_URL}/auth/criar-senha` },
  });
  if (error || !data?.properties?.action_link) {
    console.error("[reenviar-emails] Falha ao gerar link de ativação:", error);
    return null;
  }
  return data.properties.action_link;
}

async function enviar(p: Pendente): Promise<{ ok: boolean; erro: string | null }> {
  if (!RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY ausente" };
  let { assunto, texto, html } = p;
  if (p.regenerar_ativacao) {
    const link = await linkDeAtivacaoNovo(p.destinatario);
    if (!link) return { ok: false, erro: "não conseguiu gerar link de ativação novo" };
    ({ assunto, texto, html } = montarEmailAtivacao(link));
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        reply_to: "oi@usepolia.com.br",
        to: [p.destinatario],
        subject: assunto,
        text: texto,
        html,
      }),
    });
    if (!resp.ok) return { ok: false, erro: `Resend HTTP ${resp.status}: ${await resp.text()}` };
    return { ok: true, erro: null };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const agora = new Date();
  const { data, error } = await supabaseAdmin
    .from("emails_pendentes")
    .select("id, destinatario, assunto, texto, html, contexto, regenerar_ativacao, tentativas")
    .is("enviado_em", null)
    .is("desistiu_em", null)
    .lte("proxima_tentativa", agora.toISOString())
    .order("proxima_tentativa", { ascending: true })
    .limit(LOTE);
  if (error) {
    console.error("[reenviar-emails] Falha ao ler a fila:", error);
    return new Response(JSON.stringify({ ok: false, motivo: "falha_leitura" }), { status: 500 });
  }

  let enviados = 0;
  let adiados = 0;
  let desistidos = 0;
  for (const p of (data ?? []) as Pendente[]) {
    const { ok, erro } = await enviar(p);
    if (ok) {
      await supabaseAdmin
        .from("emails_pendentes")
        .update({ enviado_em: new Date().toISOString(), ultimo_erro: null })
        .eq("id", p.id);
      enviados++;
      continue;
    }
    const falhas = p.tentativas + 1;
    const proxima = proximaTentativaEm(falhas, new Date());
    if (proxima && falhas <= MAX_TENTATIVAS) {
      await supabaseAdmin
        .from("emails_pendentes")
        .update({
          tentativas: falhas,
          proxima_tentativa: proxima.toISOString(),
          ultimo_erro: semEmails(erro ?? "erro"),
        })
        .eq("id", p.id);
      adiados++;
    } else {
      await supabaseAdmin
        .from("emails_pendentes")
        .update({
          tentativas: falhas,
          desistiu_em: new Date().toISOString(),
          ultimo_erro: semEmails(erro ?? "erro"),
        })
        .eq("id", p.id);
      desistidos++;
      await dispararAlerta(
        "reenvio_email_desistiu",
        `E-mail do Stripe não saiu depois de ${falhas} tentativas: ${p.contexto}`,
        {
          email: mascararEmail(p.destinatario),
          qual: p.contexto,
          motivo: semEmails(erro ?? "erro"),
        },
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados, adiados, desistidos }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
