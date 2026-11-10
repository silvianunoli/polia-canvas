import { createClient } from "npm:@supabase/supabase-js@2";
import { MSG_RECONECTAR, acessoPertoDeVencer, type Rede } from "../_shared/redesSociais.ts";
import {
  lerCriadorTiktok,
  pedirTokenTiktok,
  renovarInstagram,
} from "../_shared/redesSociaisCliente.ts";
import { infoCriadorDaResposta } from "../_shared/redesPosts.ts";
import {
  ADIAR_MS,
  CONFERIR_DE_NOVO_MS,
  LIMITE_RODADA,
  LINK_MIDIA_MS,
  ORCAMENTO_RODADA_MS,
  PEDACO_UNICO_MAX,
  TRAVA_S,
  cabecalhoUploadTiktok,
  containersInstagram,
  corpoFotosTiktok,
  corpoVideoTiktok,
  erroGraphPassageiro,
  escolhasDoDestino,
  leituraContainerIg,
  leituraInitTiktok,
  leituraStatusTiktok,
  motivoErroInstagram,
  msgIncerto,
  msgVencido,
  problemasAntesDeEnviar,
  proximoPasso,
  statusDoPost,
  textoDeErro,
  urlMidiaPublica,
  urlPostTiktok,
  type LinhaDestino,
  type LinhaMidia,
  type LinhaPost,
  type Passo,
} from "../_shared/redesPublicar.ts";
import {
  graphGet,
  graphPost,
  iniciarFotosTiktok,
  iniciarVideoTiktok,
  statusPostTiktok,
  subirVideoTiktok,
} from "../_shared/redesPublicarCliente.ts";

// Publicador da Agenda das redes (ONE-156). Chamada só pelo pg_cron
// (disparar_redes_publicar(), migração 20261110120000) a cada minuto, e só
// quando há post vencido ou destino esperando conferência. verify_jwt
// desligado: o segredo do cron mora no Vault e é conferido por RPC, o mesmo da
// redes-token-renovar.
//
// A fila é tomada por redes_publicar_tomar (for update skip locked): o post
// vencido vira "publicando" na mesma transação, então o "Cancelar" e a rodada
// do minuto seguinte não pegam o mesmo post. Cada destino fica travado por
// TRAVA_S enquanto esta rodada mexe nele. Os passos e a regra contra post
// duplicado estão em _shared/redesPublicar.ts.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
// Endereço do Worker que entrega a foto pro TikTok baixar, num prefixo
// verificado no portal do TikTok: https://one.usepolia.com.br/api/redes/midia
const REDES_MIDIA_BASE = Deno.env.get("REDES_MIDIA_BASE") ?? "";
const BUCKET = "redes-midias";

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const COLUNAS_DESTINO =
  "id, post_id, user_id, rede, status, tt_privacidade, tt_permite_comentario, tt_permite_dueto, " +
  "tt_permite_stitch, tt_divulga_marca, tt_marca_propria, tt_conteudo_de_marca, conteudo_ia, " +
  "consentiu_em, publicando_desde, envio_id, envio_iniciado_em, externo_id";

type Conexao = {
  id: string;
  status: string;
  conta_id: string | null;
  conta_usuario: string | null;
};
type Contexto = { d: LinhaDestino; post: LinhaPost; midias: LinhaMidia[]; conexao: Conexao | null };
type TokenRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_expira_em: string | null;
};

const agoraIso = (somaMs = 0) => new Date(Date.now() + somaMs).toISOString();

async function autenticado(req: Request): Promise<boolean> {
  const recebido = req.headers.get("x-redes-token-secret") ?? "";
  if (!recebido) return false;
  const { data, error } = await db.rpc("conferir_segredo_redes_token", { p_segredo: recebido });
  if (error) console.error("[redes-publicar] Falha ao conferir o segredo:", error.message);
  return data === true;
}

// ── banco ─────────────────────────────────────────────────────────────────

async function carregar(id: string): Promise<Contexto | null> {
  const { data } = await db
    .from("redes_post_destinos")
    .select(COLUNAS_DESTINO)
    .eq("id", id)
    .maybeSingle();
  const d = data as unknown as LinhaDestino | null;
  if (!d) return null;
  const [p, m, c] = await Promise.all([
    db
      .from("redes_posts")
      .select("id, user_id, tipo, legenda, titulo")
      .eq("id", d.post_id)
      .maybeSingle(),
    db
      .from("redes_post_midias")
      .select("id, ordem, tipo, caminho, mime, bytes, largura, altura, duracao_s")
      .eq("post_id", d.post_id)
      .eq("user_id", d.user_id)
      .order("ordem"),
    db
      .from("redes_conexoes")
      .select("id, status, conta_id, conta_usuario")
      .eq("user_id", d.user_id)
      .eq("rede", d.rede)
      .maybeSingle(),
  ]);
  const post = p.data as LinhaPost | null;
  // Autorização por objeto: post, mídias e conexão precisam ser da mesma dona.
  if (!post || post.user_id !== d.user_id || m.error) return null;
  return {
    d,
    post,
    midias: (m.data ?? []) as LinhaMidia[],
    conexao: (c.data as Conexao | null) ?? null,
  };
}

async function atualizar(id: string, campos: Record<string, unknown>) {
  const { error } = await db
    .from("redes_post_destinos")
    .update({ ...campos, updated_at: agoraIso() })
    .eq("id", id);
  if (error) console.error("[redes-publicar] Falha ao gravar o destino:", id, error.message);
}

const soltar = (d: LinhaDestino) => atualizar(d.id, { trava_ate: null });
/** Antes de enviar: falha de conexão tenta de novo daqui a pouco. */
const adiar = (d: LinhaDestino, extra: Record<string, unknown> = {}) =>
  atualizar(d.id, { ...extra, trava_ate: null, conferir_em: agoraIso(ADIAR_MS) });
/** Depois de enviar: a rede está processando, confere na próxima rodada. */
const esperar = (d: LinhaDestino, extra: Record<string, unknown> = {}) =>
  atualizar(d.id, { ...extra, trava_ate: null, conferir_em: agoraIso(CONFERIR_DE_NOVO_MS) });

async function finalizar(
  d: LinhaDestino,
  status: "publicado" | "erro",
  extra: { erro?: string; externo_id?: string | null; externo_url?: string | null } = {},
) {
  await atualizar(d.id, {
    status,
    trava_ate: null,
    conferir_em: null,
    ...(status === "publicado" ? { publicado_em: agoraIso(), erro: null } : {}),
    ...extra,
  });
  // O link público da foto só vive enquanto o TikTok precisa baixar.
  if (d.rede === "tiktok")
    await db
      .from("redes_post_midias")
      .update({ publico_token: null, publico_ate: null })
      .eq("post_id", d.post_id);
  const { data } = await db.from("redes_post_destinos").select("status").eq("post_id", d.post_id);
  await db
    .from("redes_posts")
    .update({ status: statusDoPost((data ?? []) as { status: string }[]), updated_at: agoraIso() })
    .eq("id", d.post_id)
    .neq("status", "cancelado");
}

/**
 * Grava a hora do pedido que publica, só se ninguém gravou antes. false = outra
 * rodada chegou primeiro: não manda nada.
 */
async function marcarEnvio(d: LinhaDestino): Promise<boolean> {
  const { data, error } = await db
    .from("redes_post_destinos")
    .update({ envio_iniciado_em: agoraIso(), updated_at: agoraIso() })
    .eq("id", d.id)
    .is("envio_iniciado_em", null)
    .select("id");
  return !error && (data ?? []).length === 1;
}

// ── acesso à conta ────────────────────────────────────────────────────────

type Acesso = { token: string } | { falha: "reconectar" | "passageiro" };

async function marcarConexaoErro(c: Conexao, rede: Rede) {
  await db
    .from("redes_conexoes")
    .update({ status: "erro", ultimo_erro: MSG_RECONECTAR[rede], updated_at: agoraIso() })
    .eq("id", c.id);
}

async function acesso(c: Conexao | null, rede: Rede): Promise<Acesso> {
  if (!c || c.status !== "conectada") return { falha: "reconectar" };
  const { data } = await db.rpc("redes_token_ler", { p_conexao_id: c.id });
  const t = ((data as TokenRow[] | null) ?? [])[0];
  if (!t?.access_token) return { falha: "reconectar" };
  if (!acessoPertoDeVencer(t.access_expira_em, Date.now())) return { token: t.access_token };

  const r =
    rede === "tiktok"
      ? t.refresh_token && TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET
        ? await pedirTokenTiktok(
            { clientKey: TIKTOK_CLIENT_KEY, clientSecret: TIKTOK_CLIENT_SECRET },
            { grant: "refresh_token", refreshToken: t.refresh_token },
          )
        : null
      : await renovarInstagram(t.access_token);
  if (!r) return { falha: t.refresh_token ? "passageiro" : "reconectar" };
  if (!r.valor) {
    if (r.recusado) await marcarConexaoErro(c, rede);
    return { falha: r.recusado ? "reconectar" : "passageiro" };
  }
  const v = r.valor as {
    accessToken: string;
    accessExpiraEm: string;
    refreshToken?: string;
    refreshExpiraEm?: string;
  };
  const { error } = await db.rpc("redes_token_salvar", {
    p_conexao_id: c.id,
    p_access: v.accessToken,
    p_refresh: v.refreshToken ?? null,
    p_access_expira: v.accessExpiraEm,
    p_refresh_expira: v.refreshExpiraEm ?? null,
  });
  if (error) console.error("[redes-publicar] Falha ao salvar o token renovado:", c.id);
  return { token: v.accessToken };
}

function tokenAleatorio(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// ── TikTok ────────────────────────────────────────────────────────────────

async function enviarTiktok({ d, post, midias, conexao }: Contexto) {
  const a = await acesso(conexao, "tiktok");
  if ("falha" in a)
    return a.falha === "reconectar"
      ? finalizar(d, "erro", { erro: MSG_RECONECTAR.tiktok })
      : adiar(d);

  // As regras do TikTok mandam ler a conta de novo antes de enviar.
  const resposta = await lerCriadorTiktok(a.token);
  if (!resposta) return adiar(d);
  const { info, motivo } = infoCriadorDaResposta(resposta);
  if (!info)
    return finalizar(d, "erro", {
      erro: textoDeErro([motivo ?? "O TikTok não deixou essa conta postar agora."]),
    });
  const problemas = problemasAntesDeEnviar(post, midias, d, info, Date.now());
  if (problemas.length) return finalizar(d, "erro", { erro: textoDeErro(problemas) });
  const escolhas = escolhasDoDestino(d);

  if (post.tipo === "video") {
    const m = midias[0];
    const { data: arquivo, error } = await db.storage.from(BUCKET).download(m.caminho);
    if (error || !arquivo) return adiar(d);
    if (arquivo.size > PEDACO_UNICO_MAX)
      return finalizar(d, "erro", { erro: "O vídeo passa do tamanho que a Pólia One envia." });

    if (!(await marcarEnvio(d))) return soltar(d);
    const r = await iniciarVideoTiktok(
      a.token,
      corpoVideoTiktok(post.legenda, escolhas, arquivo.size),
    );
    const l = leituraInitTiktok(r?.json ?? null);
    // Vídeo sem upload não publica: falha antes do upload pode tentar de novo.
    if (l.tipo === "passageiro") return adiar(d, { envio_iniciado_em: null });
    if (l.tipo === "erro") return finalizar(d, "erro", { erro: l.motivo });
    await atualizar(d.id, { envio_id: l.publishId });
    if (!l.uploadUrl)
      return finalizar(d, "erro", { erro: "O TikTok não mandou o endereço pra subir o vídeo." });

    const subiu = await subirVideoTiktok(
      l.uploadUrl,
      arquivo,
      cabecalhoUploadTiktok(m.mime, arquivo.size),
    );
    // Recusa clara: nada foi publicado. Sem resposta: o status do TikTok decide.
    if (subiu === false)
      return finalizar(d, "erro", { erro: "O TikTok não recebeu o vídeo. Agenda de novo." });
    return esperar(d);
  }

  if (!REDES_MIDIA_BASE)
    return finalizar(d, "erro", {
      erro: "Post de fotos no TikTok ainda não está liberado na Pólia One.",
    });
  const tokens: string[] = [];
  const ate = agoraIso(LINK_MIDIA_MS);
  for (const m of midias) {
    const token = tokenAleatorio();
    const { error } = await db
      .from("redes_post_midias")
      .update({ publico_token: token, publico_ate: ate })
      .eq("id", m.id);
    if (error) return adiar(d);
    tokens.push(token);
  }
  const urls = tokens.map((t) => urlMidiaPublica(REDES_MIDIA_BASE, t));

  if (!(await marcarEnvio(d))) return soltar(d);
  const r = await iniciarFotosTiktok(
    a.token,
    corpoFotosTiktok(post.titulo, post.legenda, escolhas, urls),
  );
  // Foto vem por URL: sem resposta, o post pode ter saído. Não reenvia.
  if (!r) return finalizar(d, "erro", { erro: msgIncerto("tiktok") });
  const l = leituraInitTiktok(r.json);
  if (l.tipo === "passageiro") return adiar(d, { envio_iniciado_em: null });
  if (l.tipo === "erro") return finalizar(d, "erro", { erro: l.motivo });
  return esperar(d, { envio_id: l.publishId });
}

async function conferirTiktok({ d, post, conexao }: Contexto) {
  const a = await acesso(conexao, "tiktok");
  if ("falha" in a) return esperar(d);
  const r = await statusPostTiktok(a.token, d.envio_id ?? "");
  const l = leituraStatusTiktok(r?.json ?? null, r?.texto ?? "");
  if (l.fase === "esperando") return esperar(d);
  if (l.fase === "erro") return finalizar(d, "erro", { erro: l.motivo });
  return finalizar(d, "publicado", {
    externo_id: l.postId ?? d.envio_id,
    externo_url: urlPostTiktok(conexao?.conta_usuario ?? null, l.postId, post.tipo),
  });
}

// ── Instagram ─────────────────────────────────────────────────────────────

const idGraph = (v: unknown): string | null =>
  typeof v === "string" && /^\d{1,100}$/.test(v) ? v : null;

async function enviarInstagram({ d, post, midias, conexao }: Contexto) {
  const a = await acesso(conexao, "instagram");
  if ("falha" in a)
    return a.falha === "reconectar"
      ? finalizar(d, "erro", { erro: MSG_RECONECTAR.instagram })
      : adiar(d);
  const problemas = problemasAntesDeEnviar(post, midias, d, null, Date.now());
  if (problemas.length) return finalizar(d, "erro", { erro: textoDeErro(problemas) });

  const { data: assinadas, error } = await db.storage.from(BUCKET).createSignedUrls(
    midias.map((m) => m.caminho),
    Math.floor(LINK_MIDIA_MS / 1000),
  );
  const urls = (assinadas ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u);
  if (error || urls.length !== midias.length) return adiar(d);

  // Contêiner não publica nada: dá pra criar de novo se a rodada cair aqui.
  const conta = conexao?.conta_id ?? "me";
  const p = containersInstagram(post.tipo, post.legenda, urls);
  const criar = async (params: Record<string, string>) => {
    const r = await graphPost(a.token, `${conta}/media`, params);
    if (!r) return { passageiro: true as const };
    const id = idGraph(r.id);
    if (r.error || !id)
      return erroGraphPassageiro(r.error)
        ? { passageiro: true as const }
        : { motivo: motivoErroInstagram(r.error) };
    return { id };
  };
  const filhos: string[] = [];
  for (const item of p.itens) {
    const c = await criar(item);
    if ("passageiro" in c) return adiar(d);
    if ("motivo" in c) return finalizar(d, "erro", { erro: c.motivo });
    filhos.push(c.id);
  }
  const c = await criar(
    filhos.length ? { ...p.principal, children: filhos.join(",") } : p.principal,
  );
  if ("passageiro" in c) return adiar(d);
  if ("motivo" in c) return finalizar(d, "erro", { erro: c.motivo });
  return esperar(d, { envio_id: c.id });
}

async function conferirInstagram({ d, conexao }: Contexto) {
  const a = await acesso(conexao, "instagram");
  if ("falha" in a) return esperar(d);
  const s = await graphGet(a.token, d.envio_id ?? "", "status_code");
  if (!s || erroGraphPassageiro(s.error)) return esperar(d);
  if (s.error)
    return finalizar(d, "erro", {
      erro: "O Instagram não conseguiu processar o arquivo. Agenda de novo.",
    });

  const estado = leituraContainerIg(s.status_code);
  if (estado === "esperando") return esperar(d);
  if (estado === "ja_publicado") return finalizar(d, "erro", { erro: msgIncerto("instagram") });
  if (estado === "erro")
    return finalizar(d, "erro", {
      erro: "O Instagram não conseguiu processar o arquivo. Confere o formato e agenda de novo.",
    });

  if (!(await marcarEnvio(d))) return soltar(d);
  const conta = conexao?.conta_id ?? "me";
  const r = await graphPost(a.token, `${conta}/media_publish`, { creation_id: d.envio_id ?? "" });
  if (!r) return finalizar(d, "erro", { erro: msgIncerto("instagram") });
  const mediaId = idGraph(r.id);
  if (r.error || !mediaId) {
    // Recusa com resposta: nada saiu. Limite passageiro tenta de novo.
    if (erroGraphPassageiro(r.error)) return esperar(d, { envio_iniciado_em: null });
    return finalizar(d, "erro", { erro: motivoErroInstagram(r.error) });
  }
  const link = await graphGet(a.token, mediaId, "permalink");
  const url =
    typeof link?.permalink === "string" && link.permalink.startsWith("https://")
      ? link.permalink.slice(0, 2000)
      : null;
  return finalizar(d, "publicado", { externo_id: mediaId, externo_url: url });
}

// ── rodada ────────────────────────────────────────────────────────────────

async function processar(id: string): Promise<Passo | "sumiu"> {
  const ctx = await carregar(id);
  if (!ctx) {
    await atualizar(id, { trava_ate: null });
    return "sumiu";
  }
  const { d } = ctx;
  const passo = proximoPasso(d, Date.now());
  if (passo === "nada") await soltar(d);
  else if (passo === "vencido") await finalizar(d, "erro", { erro: msgVencido(d.rede) });
  else if (passo === "incerto") await finalizar(d, "erro", { erro: msgIncerto(d.rede) });
  else if (d.rede === "tiktok")
    await (passo === "enviar" ? enviarTiktok(ctx) : conferirTiktok(ctx));
  else await (passo === "enviar" ? enviarInstagram(ctx) : conferirInstagram(ctx));
  return passo;
}

Deno.serve(async (req: Request) => {
  if (!(await autenticado(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const inicio = Date.now();
  const { data, error } = await db.rpc("redes_publicar_tomar", {
    p_limite: LIMITE_RODADA,
    p_trava_s: TRAVA_S,
  });
  if (error) {
    console.error("[redes-publicar] Falha ao tomar a fila:", error.message);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }

  const contagem: Record<string, number> = {};
  for (const id of (data ?? []) as string[]) {
    // O que não couber nesta rodada volta pra fila da próxima.
    if (Date.now() - inicio > ORCAMENTO_RODADA_MS) {
      await atualizar(id, { trava_ate: null });
      continue;
    }
    try {
      const passo = await processar(id);
      contagem[passo] = (contagem[passo] ?? 0) + 1;
    } catch (e) {
      // Se caiu depois do pedido de publicar, a próxima rodada vê "incerto" e não reenvia.
      console.error("[redes-publicar] Falha no destino:", id, e instanceof Error ? e.message : "");
      await atualizar(id, { trava_ate: null });
      contagem.falha = (contagem.falha ?? 0) + 1;
    }
  }
  return new Response(JSON.stringify({ ok: true, contagem }), {
    headers: { "Content-Type": "application/json" },
  });
});
