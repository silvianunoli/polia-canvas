import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assinaturaMeConfere,
  corpoCotacao,
  corpoEtiqueta,
  efeitoDoAviso,
  emailPedidoEnviado,
  lerAvisoMe,
  mensagemDoMe,
  MSG_RECONECTAR_ME,
  nomeDaConta,
  opcoesDaCotacao,
  precisaRenovar,
  tokensDaResposta,
  urlAutorizacao,
  type AvisoMe,
  type DadosEtiqueta,
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
// Etapa 3: comprar, gerar, imprimir e cancelar a etiqueta dos pedidos pagos.
// Etapa 4: receber o aviso de rastreio em ?aviso=1, assinado com o secret do aplicativo.

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
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const LOJA_EMAIL_REMETENTE = Deno.env.get("LOJA_EMAIL_REMETENTE") ?? "naoresponda@usepolia.com.br";

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

/** Token da marca conectada. Null se a conexão não está de pé. */
async function tokenDaMarca(userId: string): Promise<string | null> {
  const { data: conexao } = await admin
    .from("canal_conexoes")
    .select("id")
    .eq("user_id", userId)
    .eq("canal", CANAL)
    .eq("status", "conectada")
    .maybeSingle();
  if (!conexao) return null;
  const { data } = await admin.rpc("canal_token_ler", { p_conexao_id: (conexao as { id: string }).id });
  return ((data as Array<{ access_token: string | null }> | null) ?? [])[0]?.access_token ?? null;
}

/** Quem chama já leu valor e medidas no banco. Aqui só entra o token da marca. */
async function cotar(userId: string, origem: unknown, destino: unknown, brutos: unknown) {
  const produtos = produtosValidos(brutos);
  if (!ehCep(origem) || !ehCep(destino) || !produtos) return { ok: false, erro: "parametros" };
  const token = await tokenDaMarca(userId);
  if (!token) return { ok: false, erro: "sem_conexao" };
  const r = await chamarMe("/api/v2/me/shipment/calculate", { token, corpo: corpoCotacao({ origem, destino, produtos }) });
  if (!r.ok) {
    console.error("[melhor-envio] cotação respondeu", r.status);
    return { ok: false, erro: "cotacao" };
  }
  return { ok: true, opcoes: opcoesDaCotacao(r.json) };
}

// ── etiqueta (etapa 3) ──────────────────────────────────────────────────────
// Andamento: sem nada > carrinho > paga > gerada. Cada passo grava antes do próximo, para
// um erro no meio retomar de onde parou e nunca pagar duas vezes.

interface CompraDaEtiqueta {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  cpf: string | null;
  endereco: Record<string, string> | null;
  itens: DadosEtiqueta["itens"];
  frete_servico: DadosEtiqueta["servico"] | null;
  etiqueta_id: string | null;
  etiqueta_status: "carrinho" | "paga" | "gerada" | null;
  etiqueta_custo: number | string | null;
}

async function compraDaVenda(userId: string, vendaId: string): Promise<CompraDaEtiqueta | null> {
  const { data } = await admin
    .from("loja_checkouts")
    .select("id, nome, email, whatsapp, cpf, endereco, itens, frete_servico, etiqueta_id, etiqueta_status, etiqueta_custo")
    .eq("user_id", userId)
    .eq("venda_id", vendaId)
    .eq("status", "pago")
    .eq("entrega_tipo", "frete")
    .maybeSingle();
  return (data as CompraDaEtiqueta | null) ?? null;
}

const guardarEtiqueta = (id: string, campos: Record<string, unknown>) =>
  admin.from("loja_checkouts").update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);

const aplicarCusto = (userId: string, vendaId: string, custo: number) =>
  admin.rpc("loja_etiqueta_aplicar_custo", { p_user_id: userId, p_venda_id: vendaId, p_custo: custo });

async function comTrava<T>(chave: string, fn: () => Promise<T>): Promise<T | { ok: false; erro: "ocupado" }> {
  const { data: dono } = await admin.rpc("pegar_trava_com_dono", { p_chave: chave, p_segundos: TRAVA_SEGUNDOS });
  if (typeof dono !== "string" || !dono) return { ok: false, erro: "ocupado" };
  try {
    return await fn();
  } finally {
    await admin.rpc("soltar_trava_com_dono", { p_chave: chave, p_dono: dono });
  }
}

async function saldoDaCarteira(token: string): Promise<number | null> {
  const r = await chamarMe("/api/v2/me/balance", { token });
  const saldo = r.ok ? Number((r.json as { balance?: unknown } | null)?.balance) : Number.NaN;
  return Number.isFinite(saldo) ? saldo : null;
}

/** Põe no carrinho do Melhor Envio e devolve o custo real e o saldo. Ainda não cobra. */
async function etiquetaPreparar(userId: string, vendaId: string) {
  const c = await compraDaVenda(userId, vendaId);
  if (!c) return { ok: false, erro: "sem_pedido" };
  const token = await tokenDaMarca(userId);
  if (!token) return { ok: false, erro: "sem_conexao" };
  let custo = c.etiqueta_custo == null ? null : Number(c.etiqueta_custo);
  if (!c.etiqueta_id) {
    if (!c.cpf || !c.endereco || !c.frete_servico) return { ok: false, erro: "dados" };
    const { data: loja } = await admin.from("lojas_marca").select("envio").eq("user_id", userId).maybeSingle();
    const remetente = ((loja as { envio?: { remetente?: Record<string, string> } } | null)?.envio?.remetente) ?? {};
    const montado = corpoEtiqueta({
      vendaId,
      remetente,
      nome: c.nome,
      email: c.email,
      whatsapp: c.whatsapp,
      cpf: c.cpf,
      endereco: c.endereco,
      servico: c.frete_servico,
      itens: c.itens,
    });
    if ("erro" in montado) return { ok: false, erro: montado.erro };
    const r = await chamarMe("/api/v2/me/cart", { token, corpo: montado.corpo });
    const json = r.json as { id?: unknown; price?: unknown } | null;
    custo = Number(json?.price);
    if (!r.ok || typeof json?.id !== "string" || !Number.isFinite(custo)) {
      console.error("[melhor-envio] carrinho respondeu", r.status);
      return { ok: false, erro: "carrinho", mensagem: mensagemDoMe(r.json) };
    }
    await guardarEtiqueta(c.id, { etiqueta_id: json.id, etiqueta_status: "carrinho", etiqueta_custo: custo });
  }
  return { ok: true, status: c.etiqueta_status ?? "carrinho", custo, saldo: await saldoDaCarteira(token) };
}

async function linkDeImpressao(token: string, etiquetaId: string): Promise<string | null> {
  const r = await chamarMe("/api/v2/me/shipment/print", { token, corpo: { mode: "public", orders: [etiquetaId] } });
  const url = (r.json as { url?: unknown } | null)?.url;
  return r.ok && typeof url === "string" && url.startsWith("https://") ? url : null;
}

/** Paga e gera, retomando de onde parou. Devolve o link de impressão. */
async function etiquetaComprar(userId: string, vendaId: string) {
  const inicio = await compraDaVenda(userId, vendaId);
  if (!inicio?.etiqueta_id) return { ok: false, erro: "sem_pedido" };
  return await comTrava(`me_etiqueta:${inicio.id}`, async () => {
    // Relê depois da trava: outro clique pode ter andado na frente.
    const c = await compraDaVenda(userId, vendaId);
    if (!c?.etiqueta_id) return { ok: false, erro: "sem_pedido" };
    const token = await tokenDaMarca(userId);
    if (!token) return { ok: false, erro: "sem_conexao" };
    const ordens = { orders: [c.etiqueta_id] };
    let status = c.etiqueta_status;

    if (status === "carrinho") {
      const r = await chamarMe("/api/v2/me/shipment/checkout", { token, corpo: ordens });
      const mensagem = mensagemDoMe(r.json);
      if (!r.ok && !/já foram pagas/i.test(mensagem ?? "")) {
        console.error("[melhor-envio] compra respondeu", r.status);
        return { ok: false, erro: "compra", mensagem };
      }
      await guardarEtiqueta(c.id, { etiqueta_status: "paga" });
      await aplicarCusto(userId, vendaId, Number(c.etiqueta_custo ?? 0));
      status = "paga";
    }
    if (status === "paga") {
      const r = await chamarMe("/api/v2/me/shipment/generate", { token, corpo: ordens });
      const gerada = (r.json as Record<string, { status?: unknown }> | null)?.[c.etiqueta_id]?.status === true;
      if (!r.ok || !gerada) {
        console.error("[melhor-envio] geração respondeu", r.status);
        return { ok: false, erro: "gerar", status: "paga", mensagem: mensagemDoMe(r.json) };
      }
      await guardarEtiqueta(c.id, { etiqueta_status: "gerada" });
    }
    return { ok: true, status: "gerada", url: await linkDeImpressao(token, c.etiqueta_id) };
  });
}

async function etiquetaImprimir(userId: string, vendaId: string) {
  const c = await compraDaVenda(userId, vendaId);
  if (!c?.etiqueta_id || c.etiqueta_status !== "gerada") return { ok: false, erro: "sem_pedido" };
  const token = await tokenDaMarca(userId);
  if (!token) return { ok: false, erro: "sem_conexao" };
  const url = await linkDeImpressao(token, c.etiqueta_id);
  return url ? { ok: true, status: "gerada", url } : { ok: false, erro: "imprimir" };
}

/** Do carrinho, só tira. Paga ou gerada, cancela no Melhor Envio e o custo sai da venda. */
async function etiquetaCancelar(userId: string, vendaId: string) {
  const inicio = await compraDaVenda(userId, vendaId);
  if (!inicio?.etiqueta_id) return { ok: false, erro: "sem_pedido" };
  return await comTrava(`me_etiqueta:${inicio.id}`, async () => {
    const c = await compraDaVenda(userId, vendaId);
    if (!c?.etiqueta_id) return { ok: false, erro: "sem_pedido" };
    const token = await tokenDaMarca(userId);
    if (!token) return { ok: false, erro: "sem_conexao" };
    if (c.etiqueta_status === "carrinho") {
      await chamarMe(`/api/v2/me/cart/${encodeURIComponent(c.etiqueta_id)}`, { method: "DELETE", token });
    } else {
      const r = await chamarMe("/api/v2/me/shipment/cancel", {
        token,
        corpo: { order: { id: c.etiqueta_id, reason_id: "2", description: "Cancelada pela loja" } },
      });
      const cancelada = (r.json as Record<string, { canceled?: unknown }> | null)?.[c.etiqueta_id]?.canceled === true;
      if (!r.ok || !cancelada) {
        console.error("[melhor-envio] cancelamento respondeu", r.status);
        return { ok: false, erro: "cancelar", mensagem: mensagemDoMe(r.json) };
      }
      await aplicarCusto(userId, vendaId, 0);
    }
    await guardarEtiqueta(c.id, { etiqueta_id: null, etiqueta_status: null, etiqueta_custo: null });
    return { ok: true, status: null };
  });
}

// ── rastreio (etapa 4) ─────────────────────────────────────────────────────
// O Melhor Envio tenta 5 vezes, de 15 em 15 minutos, e espera no máximo 6 segundos.

async function mandarEmailDeEnvio(c: { user_id: string; nome: string; email: string; frete_servico: { nome?: string } | null }, codigo: string | null, url: string | null) {
  if (!RESEND_API_KEY) throw new Error("sem RESEND_API_KEY");
  const [{ data: perfil }, { data: loja }] = await Promise.all([
    admin.from("profiles").select("business_name").eq("id", c.user_id).maybeSingle(),
    admin.from("lojas_marca").select("legal").eq("user_id", c.user_id).maybeSingle(),
  ]);
  const marca = String((perfil as { business_name?: string } | null)?.business_name ?? "Sua compra").trim();
  const responderPara = (loja as { legal?: { email?: string } } | null)?.legal?.email;
  const email = emailPedidoEnviado({ marca, nome: c.nome, servico: c.frete_servico?.nome ?? null, codigo, url });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${marca.replace(/[<>"]/g, "")} <${LOJA_EMAIL_REMETENTE}>`,
      to: [c.email],
      subject: email.assunto,
      html: email.html,
      ...(responderPara ? { reply_to: responderPara } : {}),
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error(`e-mail respondeu ${r.status}`);
}

async function aplicarAviso(aviso: AvisoMe) {
  const { data } = await admin
    .from("loja_checkouts")
    .select("id, user_id, venda_id, nome, email, frete_servico, rastreio_codigo, rastreio_url, rastreio_status, email_envio_em")
    .eq("etiqueta_id", aviso.etiquetaId)
    .maybeSingle();
  const c = data as {
    id: string;
    user_id: string;
    venda_id: string;
    nome: string;
    email: string;
    frete_servico: { nome?: string } | null;
    rastreio_codigo: string | null;
    rastreio_url: string | null;
    rastreio_status: string | null;
    email_envio_em: string | null;
  } | null;
  if (!c) return; // Etiqueta de fora da loja, ou já cancelada por aqui.

  const codigo = aviso.codigo ?? c.rastreio_codigo;
  const url = aviso.url ?? c.rastreio_url;
  const efeito = efeitoDoAviso(aviso.evento);

  if (efeito === "cancelada") {
    await aplicarCusto(c.user_id, c.venda_id, 0);
    await guardarEtiqueta(c.id, {
      etiqueta_id: null, etiqueta_status: null, etiqueta_custo: null,
      rastreio_codigo: null, rastreio_url: null, rastreio_status: null,
    });
    return;
  }

  // Entregue é o fim: aviso atrasado de postagem não pode voltar o status.
  const status = !efeito || c.rastreio_status === "entregue" ? c.rastreio_status : efeito;
  await guardarEtiqueta(c.id, { rastreio_codigo: codigo, rastreio_url: url, rastreio_status: status });

  if (efeito === "postada") {
    await admin.from("vendas").update({ andamento: "pronto" }).eq("id", c.venda_id).in("andamento", ["a_fazer", "em_producao"]);
  }
  if (efeito === "entregue") {
    await admin.from("vendas").update({ andamento: "entregue" }).eq("id", c.venda_id);
  }
  if (efeito === "problema" && c.rastreio_status !== "problema") {
    await admin.from("avisos").upsert(
      { user_id: c.user_id, tipo: "pedido", titulo: "Problema na entrega", corpo: `${c.nome}. Confira o envio no Melhor Envio.`.slice(0, 300), link: "/pedidos", ref_id: c.id },
      { onConflict: "tipo,ref_id", ignoreDuplicates: true },
    );
  }
  if ((efeito === "postada" || efeito === "entregue") && !c.email_envio_em) {
    // Marca antes de mandar: dois avisos juntos não mandam dois e-mails.
    const { data: marcada } = await admin
      .from("loja_checkouts")
      .update({ email_envio_em: new Date().toISOString() })
      .eq("id", c.id)
      .is("email_envio_em", null)
      .select("id");
    if (!(marcada as unknown[] | null)?.length) return;
    try {
      await mandarEmailDeEnvio(c, codigo, url);
    } catch (e) {
      await admin.from("loja_checkouts").update({ email_envio_em: null }).eq("id", c.id);
      throw e;
    }
  }
}

async function receberAviso(req: Request): Promise<Response> {
  const cru = await req.text();
  const assinatura = req.headers.get("x-me-signature");
  // Sem assinatura não faz nada: a doc não diz se o cadastro da URL manda um teste.
  if (!assinatura) return resposta({ ok: true });
  if (!(await assinaturaMeConfere(cru, ME_CLIENT_SECRET, assinatura))) return resposta({ erro: "assinatura" }, 401);
  let json: unknown = null;
  try {
    json = JSON.parse(cru);
  } catch {
    return resposta({ ok: true });
  }
  const aviso = lerAvisoMe(json);
  if (!aviso) return resposta({ ok: true });
  try {
    await aplicarAviso(aviso);
    return resposta({ ok: true });
  } catch (e) {
    console.error("[melhor-envio] aviso", aviso.evento, e instanceof Error ? e.message : String(e));
    return resposta({ erro: "falha" }, 500); // O Melhor Envio tenta de novo.
  }
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
  if (new URL(req.url).searchParams.get("aviso") === "1") return await receberAviso(req);
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
    if (typeof acao === "string" && acao.startsWith("etiqueta_")) {
      const vendaId = corpo?.venda_id;
      if (!ehUuid(vendaId)) return resposta({ ok: false, erro: "parametros" }, 400);
      if (acao === "etiqueta_preparar") return resposta(await etiquetaPreparar(userId, vendaId));
      if (acao === "etiqueta_comprar") return resposta(await etiquetaComprar(userId, vendaId));
      if (acao === "etiqueta_imprimir") return resposta(await etiquetaImprimir(userId, vendaId));
      if (acao === "etiqueta_cancelar") return resposta(await etiquetaCancelar(userId, vendaId));
    }
    return resposta({ erro: "acao" }, 400);
  } catch (e) {
    console.error("[melhor-envio]", acao, e instanceof Error ? e.message : String(e));
    return resposta({ erro: "falha" }, 500);
  }
});
