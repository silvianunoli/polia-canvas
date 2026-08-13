import { createClient } from "npm:@supabase/supabase-js@2";

// Bot de DM por gatilho (Feature C, handoff Seção 6). Recebe webhooks do
// Instagram: comentário com palavra-gatilho -> private reply automática;
// resposta na DM (mensageria) -> abre janela de 24h e avisa a Sil por e-mail
// pra ela assumir a conversa na mão (v1 não tem sequência automática).
//
// Sem verify_jwt: quem chama é a Meta, não uma usuária logada — autenticação
// pelo fluxo padrão do webhook (GET de verificação com token secreto; POST
// vem assinado, mas v1 confia no segredo da URL de assinatura do app, como
// documentado pro app review).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_VERIFY_TOKEN = Deno.env.get("WEBHOOK_VERIFY_TOKEN") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_SIL = "oi@usepolia.com.br";
const GRAPH = "https://graph.instagram.com/v23.0";
const JANELA_GATILHO_MS = 7 * 24 * 60 * 60 * 1000;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function semAcentoMinusculo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * O webhook é único por app (mesma URL pra todas as contas), mas cada evento
 * chega marcado com a conta do Instagram que o recebeu (entry.id, o
 * ig_user_id da conta profissional). Resolve pra qual conta/token da Fábrica
 * de Posts esse evento pertence.
 */
async function resolverConta(igUserIdConta: string): Promise<{ contaId: string; token: string } | null> {
  const { data } = await supabaseAdmin
    .from("contas_instagram_credenciais")
    .select("conta_id, access_token")
    .eq("ig_user_id", igUserIdConta)
    .maybeSingle();
  if (!data?.access_token) return null;
  return { contaId: data.conta_id, token: data.access_token };
}

async function enviarPrivateReply(commentId: string, mensagem: string, token: string): Promise<{ ok: boolean; erro?: string }> {
  const resp = await fetch(`${GRAPH}/${commentId}/private_replies`, {
    method: "POST",
    body: new URLSearchParams({ message: mensagem, access_token: token }),
  });
  const json = await resp.json();
  if (json.error) return { ok: false, erro: json.error.message ?? "Erro desconhecido" };
  return { ok: true };
}

async function responderComentarioPublico(commentId: string, mensagem: string, token: string): Promise<void> {
  try {
    await fetch(`${GRAPH}/${commentId}/replies`, {
      method: "POST",
      body: new URLSearchParams({ message: mensagem, access_token: token }),
    });
  } catch {
    // Resposta pública é só um "avisinho" — falhar aqui não deve derrubar o fluxo.
  }
}

async function avisarSilJanelaAberta(igUserId: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error("[ig-webhook] Missing RESEND_API_KEY — aviso de janela aberta não enviado.");
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Pólia <naoresponda@usepolia.com.br>",
        to: [EMAIL_SIL],
        subject: "Alguém respondeu a DM do @usepolia",
        text: `A conta ${igUserId} respondeu a private reply e abriu a janela de 24h. Entra no Instagram pra continuar a conversa na mão.`,
        html: `<p>A conta <strong>${igUserId}</strong> respondeu a private reply e abriu a janela de 24h.</p><p>Entra no Instagram pra continuar a conversa na mão.</p>`,
      }),
    });
  } catch (err) {
    console.error("[ig-webhook] Erro ao enviar aviso de janela aberta:", err);
  }
}

interface ChangeComentario {
  field: string;
  value: {
    id: string;
    text?: string;
    from?: { id: string; username?: string };
    media?: { id: string };
  };
}

interface MessagingEvento {
  sender?: { id: string };
  message?: { text?: string };
}

interface EntradaWebhook {
  id?: string; // ig_user_id da conta profissional que recebeu o evento
  time?: number;
  changes?: ChangeComentario[];
  messaging?: MessagingEvento[];
}

async function processarComentario(
  change: ChangeComentario,
  entryTimeMs: number | undefined,
  contaId: string,
  token: string,
) {
  const commentId = change.value.id;
  const texto = change.value.text ?? "";
  const igUserId = change.value.from?.id;
  const mediaId = change.value.media?.id;
  if (!commentId || !igUserId) return;

  if (entryTimeMs && Date.now() - entryTimeMs > JANELA_GATILHO_MS) {
    console.log(`[ig-webhook] comentário ${commentId} fora da janela de 7 dias, ignorado.`);
    return;
  }

  const textoNormalizado = semAcentoMinusculo(texto);

  const { data: gatilhos } = await supabaseAdmin
    .from("dm_gatilhos")
    .select("*")
    .eq("ativo", true)
    .eq("conta_id", contaId);
  const gatilho = (gatilhos ?? []).find((g) => {
    const bateuPalavra = textoNormalizado.includes(semAcentoMinusculo(g.palavra));
    const bateuPost = !g.post_ig_id || g.post_ig_id === mediaId;
    return bateuPalavra && bateuPost;
  });
  if (!gatilho) return;

  // Duplicidade: comment_id é unique em dm_conversas — se já existe, já respondemos.
  const { data: jaExiste } = await supabaseAdmin
    .from("dm_conversas")
    .select("id")
    .eq("comment_id", commentId)
    .maybeSingle();
  if (jaExiste) return;

  const inicioHoje = new Date();
  inicioHoje.setUTCHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("dm_conversas")
    .select("id", { count: "exact", head: true })
    .eq("gatilho_id", gatilho.id)
    .gte("criado_em", inicioHoje.toISOString());
  if ((count ?? 0) >= gatilho.max_por_dia) {
    console.log(`[ig-webhook] teto diário atingido pro gatilho ${gatilho.id}.`);
    return;
  }

  if (!token) {
    await supabaseAdmin.from("dm_conversas").insert({
      conta_id: contaId,
      ig_user_id: igUserId,
      comment_id: commentId,
      gatilho_id: gatilho.id,
      estado: "respondido",
      erro: "Token do Instagram não configurado pra essa conta.",
    });
    return;
  }

  const mensagem = `${gatilho.resposta}\n\n(responde PARAR se não quiser mais)`;
  const resultado = await enviarPrivateReply(commentId, mensagem, token);

  await supabaseAdmin.from("dm_conversas").insert({
    conta_id: contaId,
    ig_user_id: igUserId,
    comment_id: commentId,
    gatilho_id: gatilho.id,
    estado: "respondido",
    ultima_msg_em: new Date().toISOString(),
    erro: resultado.ok ? null : resultado.erro,
    log: [{ tipo: "private_reply", ok: resultado.ok, em: new Date().toISOString() }],
  });

  if (resultado.ok) {
    await responderComentarioPublico(commentId, "te mandei no direct!", token);
  } else {
    console.error(`[ig-webhook] falha ao enviar private reply pro comentário ${commentId}: ${resultado.erro}`);
  }
}

async function processarMensagem(evento: MessagingEvento, contaId: string) {
  const igUserId = evento.sender?.id;
  const texto = semAcentoMinusculo(evento.message?.text ?? "");
  if (!igUserId) return;

  if (texto.includes("parar")) {
    await supabaseAdmin
      .from("dm_conversas")
      .update({ estado: "optout" })
      .eq("ig_user_id", igUserId)
      .eq("conta_id", contaId);
    return;
  }

  const { data: conversa } = await supabaseAdmin
    .from("dm_conversas")
    .select("*")
    .eq("ig_user_id", igUserId)
    .eq("conta_id", contaId)
    .eq("estado", "respondido")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversa) {
    await supabaseAdmin
      .from("dm_conversas")
      .update({ estado: "janela_aberta", ultima_msg_em: new Date().toISOString() })
      .eq("id", conversa.id);
    await avisarSilJanelaAberta(igUserId);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const modo = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (modo === "subscribe" && token === WEBHOOK_VERIFY_TOKEN && WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: { object?: string; entry?: EntradaWebhook[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Payload inválido", { status: 400 });
  }

  // Log temporário pra diagnosticar por que comentários reais não estão
  // batendo gatilho nenhum — remover depois de confirmar a causa.
  console.log("[ig-webhook] payload recebido:", JSON.stringify(body));

  for (const entry of body.entry ?? []) {
    if (!entry.id) {
      console.log("[ig-webhook] entry sem id, não dá pra saber a conta — ignorado.");
      continue;
    }
    const conta = await resolverConta(entry.id);
    if (!conta) {
      console.log(`[ig-webhook] nenhuma conta cadastrada com ig_user_id ${entry.id} — ignorado.`);
      continue;
    }

    const entryTimeMs = entry.time;
    for (const change of entry.changes ?? []) {
      if (change.field === "comments") {
        try {
          await processarComentario(change, entryTimeMs, conta.contaId, conta.token);
        } catch (err) {
          console.error("[ig-webhook] erro processando comentário:", err);
        }
      }
    }
    for (const evento of entry.messaging ?? []) {
      try {
        await processarMensagem(evento, conta.contaId);
      } catch (err) {
        console.error("[ig-webhook] erro processando mensagem:", err);
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
});
