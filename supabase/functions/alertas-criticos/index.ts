import { createClient } from "npm:@supabase/supabase-js@2";

// Ponto único de disparo de alerta crítico pro Telegram — chamado de 3 lugares
// diferentes (Worker Cloudflare, edge function stripe-webhook, pg_cron via
// pg_net), cada um em runtime diferente, por isso vive aqui como HTTP.
// Sem verify_jwt: quem chama não tem sessão de usuária (webhook, cron, Worker
// server-to-server). Autenticação é por segredo compartilhado (ALERTAS_SECRET),
// igual em todos os chamadores.
//
// Dedup/rate-limit por tipo: no máximo 1 mensagem a cada 10 min por `tipo`.
// Repetições dentro da janela só incrementam `ocorrencias` na linha aberta;
// quando a janela fecha, o próximo evento manda mensagem nova e menciona
// quantas vezes o tipo disparou em silêncio.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALERTAS_SECRET = Deno.env.get("ALERTAS_SECRET") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

const JANELA_MS = 10 * 60 * 1000;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface AlertaInput {
  tipo: string;
  titulo: string;
  detalhes?: Record<string, unknown>;
  link?: string;
}

function autenticado(req: Request, url: URL): boolean {
  if (!ALERTAS_SECRET) return false;
  const porHeader = req.headers.get("x-alertas-secret");
  const porQuery = url.searchParams.get("secret");
  return porHeader === ALERTAS_SECRET || porQuery === ALERTAS_SECRET;
}

// "mensagem" costuma trazer o texto de exceção original de uma biblioteca de
// terceiros (Stripe, Supabase) — vem em inglês por natureza, não traduzimos
// (não dá pra traduzir texto de erro arbitrário de forma confiável). O rótulo
// deixa claro que só aquela linha específica não é português.
function rotuloChave(chave: string): string {
  return chave === "mensagem" ? "Erro técnico (original, em inglês)" : chave;
}

function formatarDetalhes(detalhes: Record<string, unknown> | undefined): string {
  if (!detalhes || Object.keys(detalhes).length === 0) return "";
  return Object.entries(detalhes)
    .map(([chave, valor]) => `${rotuloChave(chave)}: ${typeof valor === "object" ? JSON.stringify(valor) : String(valor)}`)
    .join("\n");
}

function montarMensagem(input: AlertaInput, ocorrenciasAnteriores: number): string {
  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "medium",
  });
  const linhas = [
    `🚨 Pólia — incidente de produção`,
    `Tipo: ${input.titulo}`,
    `Hora: ${agora} (America/Sao_Paulo)`,
  ];
  const detalhesTxt = formatarDetalhes(input.detalhes);
  if (detalhesTxt) linhas.push(detalhesTxt);
  if (ocorrenciasAnteriores > 1) {
    linhas.push(`Esse tipo de incidente ocorreu ${ocorrenciasAnteriores}x desde o alerta anterior (agregado).`);
  }
  if (input.link) linhas.push(`Ver: ${input.link}`);
  return linhas.join("\n");
}

async function enviarTelegram(texto: string): Promise<{ ok: boolean; resposta: string }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { ok: false, resposta: "Missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID" };
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: texto }),
    });
    const corpo = await resp.text();
    return { ok: resp.ok, resposta: corpo.slice(0, 2000) };
  } catch (err) {
    return { ok: false, resposta: String(err).slice(0, 2000) };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  if (!autenticado(req, url)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let input: AlertaInput;
  try {
    const body = await req.json();
    if (!body.tipo || !body.titulo) throw new Error("tipo e titulo são obrigatórios");
    input = { tipo: String(body.tipo), titulo: String(body.titulo), detalhes: body.detalhes, link: body.link };
  } catch (err) {
    return new Response(`Payload inválido: ${err}`, { status: 400 });
  }

  const agora = Date.now();

  const { data: ultima } = await supabaseAdmin
    .from("alertas_enviados")
    .select("id, ocorrencias, janela_fim")
    .eq("tipo", input.tipo)
    .order("janela_fim", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultima && new Date(ultima.janela_fim).getTime() > agora) {
    await supabaseAdmin
      .from("alertas_enviados")
      .update({ ocorrencias: ultima.ocorrencias + 1, atualizado_em: new Date().toISOString() })
      .eq("id", ultima.id);
    return new Response(JSON.stringify({ sent: false, deduped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ocorrenciasAnteriores = ultima?.ocorrencias ?? 0;
  const mensagem = montarMensagem(input, ocorrenciasAnteriores);
  const resultado = await enviarTelegram(mensagem);

  await supabaseAdmin.from("alertas_enviados").insert({
    tipo: input.tipo,
    titulo: input.titulo,
    detalhes: input.detalhes ?? {},
    link: input.link ?? null,
    ocorrencias: 1,
    janela_fim: new Date(agora + JANELA_MS).toISOString(),
    enviado: resultado.ok,
    resposta_provedor: resultado.resposta,
  });

  return new Response(JSON.stringify({ sent: resultado.ok }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
