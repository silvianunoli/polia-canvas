import { createClient } from "npm:@supabase/supabase-js@2";
import { enviarPush, lerContaDeServico, type Aviso } from "../_shared/fcm.ts";
import {
  avisoResumoSemana,
  avisoVendasDoDia,
  ehTipoPush,
  hojeEmBrasilia,
  semanaPassadaEmBrasilia,
} from "../_shared/pushLembretes.ts";

// Avisos push agendados (AND-06, 27/10/2026). Chamada só pelo pg_cron
// (disparar_push_lembretes(tipo), migração 20261027230000), e só quando existe
// algum aparelho cadastrado. verify_jwt desligado: quem chama não tem sessão;
// o segredo do cron mora no Vault e é conferido por RPC.
//
// - vendas_do_dia (20h): conta que registrou venda nos últimos 30 dias e
//   nenhuma hoje (RPC push_alvos_vendas_do_dia).
// - resumo_semana (segunda 9h): total e quantidade da semana que fechou (RPC
//   push_alvos_resumo_semana). Semana sem venda não recebe aviso.
// Token recusado pelo Firebase (app desinstalado) sai da tabela.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const conta = lerContaDeServico(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_B64") ?? "");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-push-lembretes-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await supabaseAdmin.rpc("conferir_segredo_push_lembretes", {
    p_segredo: recebido,
  });
  if (error) {
    console.error("[push-lembretes] Falha ao conferir o segredo:", error.message);
    return false;
  }
  return data === true;
}

type Alvo = { tokens: string[]; aviso: Aviso };

async function alvosDoTipo(tipo: "vendas_do_dia" | "resumo_semana", agora: Date): Promise<Alvo[]> {
  if (tipo === "vendas_do_dia") {
    const { data, error } = await supabaseAdmin.rpc("push_alvos_vendas_do_dia", {
      p_hoje: hojeEmBrasilia(agora),
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((l: { tokens: string[] }) => ({
      tokens: l.tokens,
      aviso: avisoVendasDoDia(),
    }));
  }
  const semana = semanaPassadaEmBrasilia(agora);
  const { data, error } = await supabaseAdmin.rpc("push_alvos_resumo_semana", {
    p_inicio: semana.inicio,
    p_fim: semana.fim,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((l: { tokens: string[]; total: number; quantidade: number }) => ({
    tokens: l.tokens,
    aviso: avisoResumoSemana(Number(l.total), l.quantidade),
  }));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });
  if (!(await autenticado(req))) return new Response("não autorizado", { status: 401 });
  if (!conta) {
    console.error("[push-lembretes] FIREBASE_SERVICE_ACCOUNT_B64 ausente ou inválido");
    return new Response("sem conta de serviço", { status: 500 });
  }

  const corpo = await req.json().catch(() => ({}));
  if (!ehTipoPush(corpo?.tipo)) return new Response("tipo inválido", { status: 400 });

  let alvos: Alvo[];
  try {
    alvos = await alvosDoTipo(corpo.tipo, new Date());
  } catch (e) {
    console.error("[push-lembretes] Falha ao ler alvos:", (e as Error).message);
    return new Response("erro ao ler alvos", { status: 500 });
  }

  let enviados = 0;
  let falhas = 0;
  const invalidos: string[] = [];
  for (const alvo of alvos) {
    for (const token of alvo.tokens) {
      try {
        const resultado = await enviarPush(conta, token, alvo.aviso);
        if (resultado === "ok") enviados++;
        else if (resultado === "token_invalido") invalidos.push(token);
        else falhas++;
      } catch (e) {
        falhas++;
        console.error("[push-lembretes] Falha no envio:", (e as Error).message);
      }
    }
  }
  if (invalidos.length > 0) {
    await supabaseAdmin.from("push_aparelhos").delete().in("token", invalidos);
  }

  const resumo = {
    tipo: corpo.tipo,
    contas: alvos.length,
    enviados,
    falhas,
    removidos: invalidos.length,
  };
  console.log("[push-lembretes]", JSON.stringify(resumo));
  return Response.json(resumo);
});
