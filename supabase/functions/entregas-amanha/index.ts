import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarPush, lerContaDeServico } from "../_shared/fcm.ts";
import {
  amanhaEmBrasilia,
  avisoEntregasAmanha,
  montarEmailEntregasAmanha,
  type PedidoDaEntrega,
} from "../_shared/entregasAmanha.ts";
import { mascararEmail } from "../_shared/stripeWebhookRegras.ts";

// Aviso da véspera (ONE-174, 05/11/2026). Chamada só pelo pg_cron às 18h de
// Brasília (disparar_entregas_amanha(), migrações 20261105220000 e
// 20261105220100), e só quando existe pedido aberto pra amanhã. verify_jwt
// desligado: quem chama não tem sessão; o segredo do cron mora no Vault e é
// conferido por RPC.
//
// O e-mail é o canal principal: push exige o app, e o envio sai mesmo sem conta
// de serviço do Firebase. Cada dona é marcada em entregas_amanha_envios antes de
// enviar, então repetir a chamada não manda em dobro, e envio que falha não
// insiste (como no lembretes-conta). Token recusado pelo Firebase sai da tabela.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const conta = lerContaDeServico(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64") ?? "");

// O Resend aceita 2 envios por segundo no plano padrão.
const PAUSA_ENTRE_EMAILS_MS = 600;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Alvo = { user_id: string; email: string; tokens: string[]; pedidos: PedidoDaEntrega[] };

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-entregas-amanha-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_entregas_amanha", {
    p_segredo: recebido,
  });
  if (error) {
    console.error("[entregas-amanha] Falha ao conferir o segredo:", error.message);
    return false;
  }
  return data === true;
}

async function enviarEmail(alvo: Alvo): Promise<string | null> {
  const email = montarEmailEntregasAmanha(alvo.pedidos);
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Pólia <naoresponda@usepolia.com.br>",
      reply_to: "oi@usepolia.com.br",
      to: [alvo.email],
      subject: email.assunto,
      text: email.texto,
      html: email.html,
    }),
  });
  return resp.ok ? null : `Resend HTTP ${resp.status}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });
  if (!(await autenticado(req))) return new Response("não autorizado", { status: 401 });
  if (!RESEND_API_KEY) return new Response("sem resend", { status: 500 });
  if (!conta) console.error("[entregas-amanha] Sem conta de serviço: só o e-mail vai sair");

  const dia = amanhaEmBrasilia(new Date());
  const { data, error } = await supabaseAdmin.rpc("alvos_entregas_amanha", { p_amanha: dia });
  if (error) {
    console.error("[entregas-amanha] Falha ao ler alvos:", error.message);
    return new Response("erro ao ler alvos", { status: 500 });
  }
  const alvos = (data ?? []) as Alvo[];

  let emails = 0;
  let pushes = 0;
  let falhas = 0;
  const invalidos: string[] = [];
  for (const alvo of alvos) {
    // Conflito = outra execução já pegou essa dona.
    const { error: erroMarca } = await supabaseAdmin
      .from("entregas_amanha_envios")
      .insert({ user_id: alvo.user_id, dia });
    if (erroMarca) continue;

    const erro = await enviarEmail(alvo).catch((e: Error) => e.message);
    if (erro) {
      falhas++;
      console.error(`[entregas-amanha] E-mail não saiu pra ${mascararEmail(alvo.email)}: ${erro}`);
    } else {
      emails++;
    }

    if (conta) {
      const aviso = avisoEntregasAmanha(alvo.pedidos.length);
      for (const token of alvo.tokens) {
        try {
          const resultado = await enviarPush(conta, token, aviso);
          if (resultado === "ok") pushes++;
          else if (resultado === "token_invalido") invalidos.push(token);
          else falhas++;
        } catch (e) {
          falhas++;
          console.error("[entregas-amanha] Falha no push:", (e as Error).message);
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_EMAILS_MS));
  }
  if (invalidos.length > 0) {
    await supabaseAdmin.from("push_aparelhos").delete().in("token", invalidos);
  }

  const resumo = { dia, contas: alvos.length, emails, pushes, falhas, removidos: invalidos.length };
  console.log("[entregas-amanha]", JSON.stringify(resumo));
  return Response.json(resumo);
});
