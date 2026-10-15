import { createClient } from "npm:@supabase/supabase-js@2";
import {
  lembreteDeConfirmacao,
  montarEmailConfirmacao,
  type TipoLembrete,
} from "../_shared/lembretesConta.ts";
import { mascararEmail } from "../_shared/stripeWebhookRegras.ts";

// Lembretes pra conta nova (GRW-33, 14/10/2026). Chamada só pelo pg_cron
// (disparar_lembretes_conta(), migração 20261014120000) a cada 15 min, e só
// quando há conta sem confirmação na janela. verify_jwt desligado: quem chama
// não tem sessão; o segredo do cron mora no Vault e é conferido por RPC.
//
// Hoje: lembrete de confirmação de e-mail (1h e 24h). O link é um magiclink
// novo: abrir confirma o e-mail e já entra na conta.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE_URL = "https://one.usepolia.com.br";
const LOTE = 30;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-lembretes-conta-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_lembretes_conta", {
    p_segredo: recebido,
  });
  if (error) {
    console.error("[lembretes-conta] Falha ao conferir o segredo:", error.message);
    return false;
  }
  return data === true;
}

async function linkQueConfirma(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE_URL}/painel` },
  });
  if (error || !data?.properties?.action_link) {
    console.error("[lembretes-conta] Falha ao gerar link:", error?.message);
    return null;
  }
  return data.properties.action_link;
}

async function enviar(email: string, assunto: string, texto: string, html: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Pólia <naoresponda@usepolia.com.br>",
      reply_to: "oi@usepolia.com.br",
      to: [email],
      subject: assunto,
      text: texto,
      html,
    }),
  });
  return resp.ok ? null : `Resend HTTP ${resp.status}`;
}

type Conta = { user_id: string; email: string; criado_em: string; enviados: string[] };

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: false, motivo: "sem_resend" }), { status: 500 });
  }

  const { data, error } = await supabaseAdmin.rpc("contas_sem_confirmacao");
  if (error) {
    console.error("[lembretes-conta] Falha ao ler contas:", error.message);
    return new Response(JSON.stringify({ ok: false, motivo: "falha_leitura" }), { status: 500 });
  }

  const agora = new Date();
  let enviados = 0;
  let falhas = 0;
  for (const c of ((data ?? []) as Conta[]).slice(0, LOTE)) {
    const tipo = lembreteDeConfirmacao(
      new Date(c.criado_em),
      agora,
      new Set(c.enviados as TipoLembrete[]),
    );
    if (!tipo) continue;

    // Marca antes de enviar: se o envio falhar, não insiste a cada 15 min
    // (o próximo lembrete da janela ainda vem). Conflito = outra execução já pegou.
    const { error: erroMarca } = await supabaseAdmin
      .from("lembretes_conta")
      .insert({ user_id: c.user_id, tipo });
    if (erroMarca) continue;

    const link = await linkQueConfirma(c.email);
    if (!link) {
      falhas++;
      continue;
    }
    const { assunto, texto, html } = montarEmailConfirmacao(tipo, link);
    const erro = await enviar(c.email, assunto, texto, html);
    if (erro) {
      falhas++;
      console.error(`[lembretes-conta] ${tipo} não saiu pra ${mascararEmail(c.email)}: ${erro}`);
    } else {
      enviados++;
    }
  }

  return new Response(JSON.stringify({ ok: true, enviados, falhas }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
