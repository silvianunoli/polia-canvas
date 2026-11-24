import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarPush, lerContaDeServico } from "../_shared/fcm.ts";
import {
  avisoLembretes,
  avisosDoDia,
  ehAntecedencia,
  ehRepeticao,
  montarEmailLembretes,
  type Lembrete,
} from "../_shared/lembretesCalendario.ts";
import { hojeEmBrasilia } from "../_shared/pushLembretes.ts";
import { mascararEmail } from "../_shared/stripeWebhookRegras.ts";

// Avisos dos lembretes do Calendário (ONE-244, 24/11/2026). Chamada só pelo
// pg_cron às 8h de Brasília (disparar_lembretes_calendario(), migrações
// 20261124140000 e 20261124140100), e só quando existe lembrete com aviso.
// verify_jwt desligado: quem chama não tem sessão; o segredo do cron mora no
// Vault e é conferido por RPC.
//
// Uma dona com três lembretes no dia recebe um e-mail só, com os três. Cada
// ocorrência é marcada em lembretes_envios antes de enviar: repetir a chamada
// não manda em dobro, e envio que falha não insiste (como no entregas-amanha).
// Token recusado pelo Firebase sai da tabela.
//
// POST {"so_user_id": "<uuid>"} restringe a uma conta: é como a função foi
// testada na conta de teste da Sil (+teste2, Pro) antes de o cron ser ligado.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const conta = lerContaDeServico(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64") ?? "");

// O Resend aceita 2 envios por segundo no plano padrão.
const PAUSA_ENTRE_EMAILS_MS = 600;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Alvo = { user_id: string; email: string; tokens: string[]; lembretes: unknown[] };

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-lembretes-calendario-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_lembretes_calendario", {
    p_segredo: recebido,
  });
  if (error) {
    console.error("[lembretes-calendario] Falha ao conferir o segredo:", error.message);
    return false;
  }
  return data === true;
}

/** Linha do banco -> Lembrete. Linha fora do formato fica de fora. */
function lerLembrete(bruto: unknown): Lembrete | null {
  const l = bruto as Record<string, unknown> | null;
  if (!l || typeof l.id !== "string" || typeof l.titulo !== "string" || typeof l.dia !== "string")
    return null;
  if (!ehRepeticao(l.repeticao) || !ehAntecedencia(l.avisar_dias_antes)) return null;
  return {
    id: l.id,
    titulo: l.titulo,
    observacao: typeof l.observacao === "string" ? l.observacao : null,
    dia: l.dia,
    horario: typeof l.horario === "string" ? l.horario : null,
    repeticao: l.repeticao,
    avisar_dias_antes: l.avisar_dias_antes,
    feitos: Array.isArray(l.feitos)
      ? l.feitos.filter((f): f is string => typeof f === "string")
      : [],
  };
}

async function enviarEmail(para: string, conteudo: ReturnType<typeof montarEmailLembretes>) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Pólia <naoresponda@usepolia.com.br>",
      reply_to: "oi@usepolia.com.br",
      to: [para],
      subject: conteudo.assunto,
      text: conteudo.texto,
      html: conteudo.html,
    }),
  });
  return resp.ok ? null : `Resend HTTP ${resp.status}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });
  if (!(await autenticado(req))) return new Response("não autorizado", { status: 401 });
  if (!RESEND_API_KEY) return new Response("sem resend", { status: 500 });
  if (!conta) console.error("[lembretes-calendario] Sem conta de serviço: só o e-mail vai sair");

  const corpo = (await req.json().catch(() => ({}))) as { so_user_id?: unknown };
  const soUserId =
    typeof corpo.so_user_id === "string" && UUID.test(corpo.so_user_id) ? corpo.so_user_id : null;

  const hoje = hojeEmBrasilia(new Date());
  const { data, error } = await supabaseAdmin.rpc("alvos_lembretes", { p_hoje: hoje });
  if (error) {
    console.error("[lembretes-calendario] Falha ao ler alvos:", error.message);
    return new Response("erro ao ler alvos", { status: 500 });
  }
  const alvos = ((data ?? []) as Alvo[]).filter((a) => !soUserId || a.user_id === soUserId);

  let contas = 0;
  let emails = 0;
  let pushes = 0;
  let falhas = 0;
  const invalidos: string[] = [];
  for (const alvo of alvos) {
    const lembretes = alvo.lembretes.map(lerLembrete).filter((l): l is Lembrete => l !== null);
    const candidatos = avisosDoDia(lembretes, hoje);
    if (candidatos.length === 0) continue;

    // Marca antes de enviar. Só o que entrou agora vai no aviso: o que já estava
    // marcado saiu numa execução anterior.
    const { data: marcados, error: erroMarca } = await supabaseAdmin
      .from("lembretes_envios")
      .upsert(
        candidatos.map((c) => ({ lembrete_id: c.lembrete.id, ocorrencia: c.ocorrencia })),
        { onConflict: "lembrete_id,ocorrencia", ignoreDuplicates: true },
      )
      .select("lembrete_id, ocorrencia");
    if (erroMarca) {
      falhas++;
      console.error("[lembretes-calendario] Falha ao marcar envio:", erroMarca.message);
      continue;
    }
    const novos = new Set((marcados ?? []).map((m) => `${m.lembrete_id}|${m.ocorrencia}`));
    const avisos = candidatos.filter((c) => novos.has(`${c.lembrete.id}|${c.ocorrencia}`));
    if (avisos.length === 0) continue;
    contas++;

    const erro = await enviarEmail(alvo.email, montarEmailLembretes(avisos, hoje)).catch(
      (e: Error) => e.message,
    );
    if (erro) {
      falhas++;
      console.error(
        `[lembretes-calendario] E-mail não saiu pra ${mascararEmail(alvo.email)}: ${erro}`,
      );
    } else {
      emails++;
    }

    if (conta) {
      const aviso = avisoLembretes(avisos, hoje);
      for (const token of alvo.tokens) {
        try {
          const resultado = await enviarPush(conta, token, aviso);
          if (resultado === "ok") pushes++;
          else if (resultado === "token_invalido") invalidos.push(token);
          else falhas++;
        } catch (e) {
          falhas++;
          console.error("[lembretes-calendario] Falha no push:", (e as Error).message);
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_EMAILS_MS));
  }
  if (invalidos.length > 0) {
    await supabaseAdmin.from("push_aparelhos").delete().in("token", invalidos);
  }

  const resumo = { hoje, contas, emails, pushes, falhas, removidos: invalidos.length };
  console.log("[lembretes-calendario]", JSON.stringify(resumo));
  return Response.json(resumo);
});
