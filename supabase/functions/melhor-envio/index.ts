import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corpoCotacao,
  MSG_RECONECTAR_ME,
  nomeDaConta,
  opcoesDaCotacao,
  precisaRenovar,
  tokensDaResposta,
  urlAutorizacao,
  type ProdutoCotacao,
} from "../_shared/melhorEnvio.ts";

// Único lugar que fala com o Melhor Envio (ONE-189). O segredo do aplicativo mora só nos
// secrets desta função (ME_CLIENT_ID, ME_CLIENT_SECRET, ME_BASE). Quem chama manda o
// segredo interno do Vault no cabeçalho x-melhor-envio-segredo: o cron, o Worker da
// Pólia One (com o user_id já autenticado lá) e, depois, o Worker das lojas.
// verify_jwt desligado, como as outras funções deste repo.
//
// Etapa 1: iniciar a conexão, trocar o code, desconectar e renovar o token (cron).
// Etapa 2: cotar o frete para o checkout da loja.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ME_BASE = (Deno.env.get("ME_BASE") ?? "https://sandbox.melhorenvio.com.br").replace(/\/$/, "");
const ME_CLIENT_ID = Deno.env.get("ME_CLIENT_ID") ?? "";
const ME_CLIENT_SECRET = Deno.env.get("ME_CLIENT_SECRET") ?? "";
const ME_REDIRECT =
  Deno.env.get("ME_REDIRECT_URI") ?? "https://one.usepolia.com.br/configuracoes/integracoes/melhor-envio";
// O Melhor Envio exige nome da aplicação e e-mail de contato técnico no User-Agent.
const USER_AGENT = "Polia One (oi@usepolia.com.br)";
const CANAL = "melhor_envio";
const TRAVA_SEGUNDOS = 60;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

async function autorizado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-melhor-envio-segredo") ?? "";
  if (!recebido) return false;
  const { data, error } = await admin.rpc("conferir_segredo_melhor_envio", { p_segredo: recebido });
  if (error) console.error("[melhor-envio] conferir segredo:", error.message);
  return data === true;
}

async function chamarMe(caminho: string, init: { method?: string; token?: string; corpo?: unknown } = {}) {
  const r = await fetch(`${ME_BASE}${caminho}`, {
    method: init.method ?? (init.corpo ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.corpo ? JSON.stringify(init.corpo) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, json };
}

interface Conexao {
  id: string;
  status: string;
  state_pendente: string | null;
}

async function lerConexao(userId: string): Promise<Conexao | null> {
  const { data } = await admin
    .from("canal_conexoes")
    .select("id, status, state_pendente")
    .eq("user_id", userId)
    .eq("canal", CANAL)
    .maybeSingle();
  return (data as Conexao | null) ?? null;
}

const ehUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function iniciar(userId: string) {
  if (!ME_CLIENT_ID || !ME_CLIENT_SECRET) return { url: null, erro: "nao_configurado" };
  const atual = await lerConexao(userId);
  if (atual?.status === "conectada") return { url: null, erro: "ja_conectada" };
  const state = crypto.randomUUID();
  const { error } = await admin.from("canal_conexoes").upsert(
    { user_id: userId, canal: CANAL, status: "pendente", state_pendente: state, updated_at: new Date().toISOString() },
    { onConflict: "user_id,canal" },
  );
  if (error) {
    console.error("[melhor-envio] iniciar:", error.message);
    return { url: null, erro: "falha" };
  }
  return { url: urlAutorizacao({ base: ME_BASE, clientId: ME_CLIENT_ID, redirect: ME_REDIRECT, state }), erro: null };
}

async function trocar(userId: string, code: string, state: string) {
  const conexao = await lerConexao(userId);
  if (!conexao || !conexao.state_pendente || conexao.state_pendente !== state) return { ok: false, erro: "state" };
  // O state vale uma vez: zera antes de trocar o code.
  await admin.from("canal_conexoes").update({ state_pendente: null }).eq("id", conexao.id);

  const r = await chamarMe("/oauth/token", {
    corpo: { grant_type: "authorization_code", client_id: ME_CLIENT_ID, client_secret: ME_CLIENT_SECRET, redirect_uri: ME_REDIRECT, code },
  });
  const tokens = r.ok ? tokensDaResposta(r.json, Date.now()) : null;
  if (!tokens) {
    console.error("[melhor-envio] troca do code respondeu", r.status);
    return { ok: false, erro: "troca" };
  }
  const conta = await chamarMe("/api/v2/me", { token: tokens.accessToken });
  const { id: contaId, nome } = nomeDaConta(conta.ok ? conta.json : null);

  const { error: erroToken } = await admin.rpc("canal_token_salvar", {
    p_conexao_id: conexao.id,
    p_access: tokens.accessToken,
    p_refresh: tokens.refreshToken,
    p_access_expira: tokens.accessExpiraEm,
    p_refresh_expira: tokens.refreshExpiraEm,
  });
  if (erroToken) {
    console.error("[melhor-envio] salvar token:", erroToken.message);
    return { ok: false, erro: "salvar" };
  }
  const { error } = await admin
    .from("canal_conexoes")
    .update({ status: "conectada", shop_id: contaId, loja_nome: nome, ultimo_erro: null, updated_at: new Date().toISOString() })
    .eq("id", conexao.id);
  if (error) return { ok: false, erro: "salvar" };
  return { ok: true, erro: null, nome };
}

async function desconectar(userId: string) {
  // O gatilho canal_conexoes_apagar_segredos leva os tokens do Vault junto.
  const { error } = await admin.from("canal_conexoes").delete().eq("user_id", userId).eq("canal", CANAL);
  return { ok: !error };
}

const ehCep = (v: unknown): v is string => typeof v === "string" && /^[0-9]{8}$/.test(v);

function produtosValidos(v: unknown): ProdutoCotacao[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > 50) return null;
  const positivo = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
  for (const p of v as ProdutoCotacao[]) {
    if (!p || typeof p.id !== "string" || !Number.isInteger(p.quantidade) || p.quantidade < 1 || p.quantidade > 99) return null;
    if (!positivo(p.peso_kg) || !positivo(p.altura_cm) || !positivo(p.largura_cm) || !positivo(p.comprimento_cm)) return null;
    if (typeof p.valor !== "number" || !Number.isFinite(p.valor) || p.valor < 0) return null;
  }
  return v as ProdutoCotacao[];
}

/** Quem chama já leu valor e medidas no banco. Aqui só entra o token da marca. */
async function cotar(userId: string, origem: unknown, destino: unknown, brutos: unknown) {
  const produtos = produtosValidos(brutos);
  if (!ehCep(origem) || !ehCep(destino) || !produtos) return { ok: false, erro: "parametros" };
  const { data: conexao } = await admin
    .from("canal_conexoes")
    .select("id")
    .eq("user_id", userId)
    .eq("canal", CANAL)
    .eq("status", "conectada")
    .maybeSingle();
  if (!conexao) return { ok: false, erro: "sem_conexao" };
  const { data } = await admin.rpc("canal_token_ler", { p_conexao_id: (conexao as { id: string }).id });
  const token = ((data as Array<{ access_token: string | null }> | null) ?? [])[0]?.access_token;
  if (!token) return { ok: false, erro: "sem_conexao" };
  const r = await chamarMe("/api/v2/me/shipment/calculate", { token, corpo: corpoCotacao({ origem, destino, produtos }) });
  if (!r.ok) {
    console.error("[melhor-envio] cotação respondeu", r.status);
    return { ok: false, erro: "cotacao" };
  }
  return { ok: true, opcoes: opcoesDaCotacao(r.json) };
}

async function marcarErro(conexaoId: string) {
  await admin
    .from("canal_conexoes")
    .update({ status: "erro", ultimo_erro: MSG_RECONECTAR_ME, updated_at: new Date().toISOString() })
    .eq("id", conexaoId);
}

/** Renova uma conexão com trava: o token de renovação não pode ser usado duas vezes. */
async function renovarConexao(conexaoId: string): Promise<"ok" | "erro" | "pulou"> {
  const chave = `me_token:${conexaoId}`;
  const { data: dono } = await admin.rpc("pegar_trava_com_dono", { p_chave: chave, p_segundos: TRAVA_SEGUNDOS });
  if (typeof dono !== "string" || !dono) return "pulou";
  try {
    const { data } = await admin.rpc("canal_token_ler", { p_conexao_id: conexaoId });
    const t = ((data as Array<{ refresh_token: string | null; access_expira_em: string | null }> | null) ?? [])[0];
    if (!t?.refresh_token) {
      await marcarErro(conexaoId);
      return "erro";
    }
    if (!precisaRenovar(t.access_expira_em, Date.now())) return "pulou";
    const r = await chamarMe("/oauth/token", {
      corpo: { grant_type: "refresh_token", client_id: ME_CLIENT_ID, client_secret: ME_CLIENT_SECRET, refresh_token: t.refresh_token },
    });
    const tokens = r.ok ? tokensDaResposta(r.json, Date.now()) : null;
    if (!tokens) {
      // 400 e 401 são recusa (renovação vencida ou revogada). Outro erro, o cron tenta amanhã.
      if (r.status === 400 || r.status === 401) {
        await marcarErro(conexaoId);
        return "erro";
      }
      return "pulou";
    }
    const { error } = await admin.rpc("canal_token_salvar", {
      p_conexao_id: conexaoId,
      p_access: tokens.accessToken,
      p_refresh: tokens.refreshToken,
      p_access_expira: tokens.accessExpiraEm,
      p_refresh_expira: tokens.refreshExpiraEm,
    });
    if (error) {
      console.error("[melhor-envio] salvar token renovado:", error.message);
      await marcarErro(conexaoId);
      return "erro";
    }
    return "ok";
  } finally {
    await admin.rpc("soltar_trava_com_dono", { p_chave: chave, p_dono: dono });
  }
}

async function renovar() {
  if (!ME_CLIENT_ID || !ME_CLIENT_SECRET) return { ok: false, contagem: null };
  const { data, error } = await admin
    .from("canal_conexoes")
    .select("id, access_expira_em")
    .eq("canal", CANAL)
    .eq("status", "conectada")
    .limit(200);
  if (error) return { ok: false, contagem: null };
  const contagem = { ok: 0, erro: 0, pulou: 0 };
  for (const c of (data ?? []) as Array<{ id: string; access_expira_em: string | null }>) {
    if (!precisaRenovar(c.access_expira_em, Date.now())) continue;
    contagem[await renovarConexao(c.id)]++;
  }
  return { ok: true, contagem };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);
  if (!(await autorizado(req))) return resposta({ erro: "nao_autorizado" }, 401);
  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const acao = corpo?.acao;
  try {
    if (acao === "renovar") return resposta(await renovar());
    const userId = corpo?.user_id;
    if (!ehUuid(userId)) return resposta({ erro: "user_id" }, 400);
    if (acao === "iniciar") return resposta(await iniciar(userId));
    if (acao === "trocar") {
      const code = typeof corpo?.code === "string" ? corpo.code.slice(0, 4096) : "";
      const state = typeof corpo?.state === "string" ? corpo.state.slice(0, 100) : "";
      if (!code || !state) return resposta({ ok: false, erro: "parametros" }, 400);
      return resposta(await trocar(userId, code, state));
    }
    if (acao === "desconectar") return resposta(await desconectar(userId));
    if (acao === "cotar") return resposta(await cotar(userId, corpo?.cep_origem, corpo?.cep_destino, corpo?.produtos));
    return resposta({ erro: "acao" }, 400);
  } catch (e) {
    console.error("[melhor-envio]", acao, e instanceof Error ? e.message : String(e));
    return resposta({ erro: "falha" }, 500);
  }
});
