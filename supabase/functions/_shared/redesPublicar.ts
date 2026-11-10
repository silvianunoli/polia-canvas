// Regras puras do publicador da Agenda das redes (ONE-156). Sem fetch e sem
// ambiente: a edge function redes-publicar decide o passo de cada destino e
// monta o corpo de cada chamada daqui, e os testes (src/lib/redesPublicar.test.ts)
// conferem tudo sem rede.
//
// Contra post duplicado (lição da Fábrica, 28/10): "envio_iniciado_em" é gravado
// ANTES do pedido que publica (init do TikTok, media_publish do Instagram). Se
// a rodada morrer depois disso sem guardar a resposta, o destino nunca reenvia
// sozinho: vira "não publicou" pedindo pra conferir na rede.
//
// Formatos lidos nas referências oficiais em 10/11/2026: TikTok Direct Post
// (vídeo e foto), Media Transfer Guide, Get Post Status; Instagram Content
// Publishing (Instagram Login).

import { NOME_REDE, type Rede } from "./redesSociais.ts";
import {
  PRIVACIDADES_TIKTOK,
  problemasDoPost,
  type EscolhasTiktok,
  type InfoCriadorTiktok,
  type MidiaPost,
  type PrivacidadeTiktok,
  type StatusDestino,
  type TipoPost,
} from "./redesPosts.ts";

/** Quanto tempo uma rodada segura um destino antes de outra poder pegar: passa do
 * limite de execução da edge function (400 s), pra subir 50 MB sem outra rodada entrar. */
export const TRAVA_S = 420;
/** Destinos tomados por rodada do cron (uma por minuto). */
export const LIMITE_RODADA = 10;
/** Tempo de trabalho de uma rodada; o que sobrar volta pra fila. */
export const ORCAMENTO_RODADA_MS = 100_000;
/** Intervalo entre uma conferência de processamento e a próxima. */
export const CONFERIR_DE_NOVO_MS = 30_000;
/** Antes de enviar, falha de conexão espera esse tanto e tenta de novo. */
export const ADIAR_MS = 60_000;
/** Depois de 2 horas publicando sem confirmação, o destino desiste. */
export const PRAZO_CONFIRMAR_MS = 2 * 60 * 60 * 1000;
/** Validade do link da foto que o TikTok baixa, e do link assinado do Instagram. */
export const LINK_MIDIA_MS = 2 * 60 * 60 * 1000;
/** O TikTok aceita um pedaço só até 64 MB (Media Transfer Guide). */
export const PEDACO_UNICO_MAX = 64 * 1024 * 1024;

// ── linhas do banco ───────────────────────────────────────────────────────

export type LinhaDestino = {
  id: string;
  post_id: string;
  user_id: string;
  rede: Rede;
  status: StatusDestino;
  tt_privacidade: string | null;
  tt_permite_comentario: boolean;
  tt_permite_dueto: boolean;
  tt_permite_stitch: boolean;
  tt_divulga_marca: boolean;
  tt_marca_propria: boolean;
  tt_conteudo_de_marca: boolean;
  conteudo_ia: boolean;
  consentiu_em: string | null;
  publicando_desde: string | null;
  envio_id: string | null;
  envio_iniciado_em: string | null;
  externo_id: string | null;
};

export type LinhaPost = {
  id: string;
  user_id: string;
  tipo: TipoPost;
  legenda: string;
  titulo: string | null;
};

export type LinhaMidia = {
  id: string;
  ordem: number;
  tipo: "video" | "imagem";
  caminho: string;
  mime: string;
  bytes: number | null;
  largura: number | null;
  altura: number | null;
  duracao_s: number | string | null;
};

function ehPrivacidade(v: string | null): v is PrivacidadeTiktok {
  return v !== null && (PRIVACIDADES_TIKTOK as readonly string[]).includes(v);
}

export function escolhasDoDestino(d: LinhaDestino): EscolhasTiktok {
  return {
    privacidade: ehPrivacidade(d.tt_privacidade) ? d.tt_privacidade : null,
    permiteComentario: d.tt_permite_comentario,
    permiteDueto: d.tt_permite_dueto,
    permiteStitch: d.tt_permite_stitch,
    divulgaMarca: d.tt_divulga_marca,
    marcaPropria: d.tt_marca_propria,
    conteudoDeMarca: d.tt_conteudo_de_marca,
    conteudoIa: d.conteudo_ia,
  };
}

export function midiasDoPost(linhas: LinhaMidia[]): MidiaPost[] {
  return [...linhas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((m) => ({
      ordem: m.ordem,
      tipo: m.tipo,
      caminho: m.caminho,
      mime: m.mime,
      bytes: m.bytes ?? 0,
      largura: m.largura,
      altura: m.altura,
      duracaoS: m.duracao_s === null ? null : Number(m.duracao_s),
    }));
}

// ── o passo de cada destino ───────────────────────────────────────────────

export type Passo = "nada" | "enviar" | "conferir" | "incerto" | "vencido";

/**
 * O que a rodada faz com o destino. A ordem importa: "incerto" vem antes de
 * "conferir" no Instagram porque lá o contêiner (envio_id) existe antes do
 * pedido de publicar.
 */
export function proximoPasso(d: LinhaDestino, agora: number): Passo {
  if (d.status !== "publicando") return "nada";
  const desde = d.publicando_desde ? Date.parse(d.publicando_desde) : agora;
  if (agora - desde > PRAZO_CONFIRMAR_MS) {
    // Pedido que já saiu e não voltou cai no aviso de conferir, não no de prazo.
    return d.envio_iniciado_em && !d.externo_id && !d.envio_id ? "incerto" : "vencido";
  }
  if (d.rede === "tiktok") {
    if (d.envio_id) return "conferir";
    return d.envio_iniciado_em ? "incerto" : "enviar";
  }
  if (d.envio_iniciado_em) return "incerto";
  return d.envio_id ? "conferir" : "enviar";
}

/**
 * As regras da fase 3 de novo, com o creator_info da hora e as escolhas
 * gravadas. O horário já passou (quando = agora) e o consentimento é o gravado.
 */
export function problemasAntesDeEnviar(
  post: LinhaPost,
  midias: LinhaMidia[],
  d: LinhaDestino,
  criador: InfoCriadorTiktok | null,
  agora: number,
): string[] {
  const tt = d.rede === "tiktok";
  return problemasDoPost(
    {
      postId: post.id,
      tipo: post.tipo,
      legenda: post.legenda,
      titulo: tt ? post.titulo : null,
      midias: midiasDoPost(midias),
      redes: [d.rede],
      tiktok: tt ? escolhasDoDestino(d) : null,
      quando: { modo: "agora" },
      consentiu: !!d.consentiu_em,
    },
    { userId: post.user_id, agora, conectadas: [d.rede], criador: tt ? criador : null },
  );
}

/** Erro no banco tem até 500 caracteres. */
export function textoDeErro(erros: string[]): string {
  return erros.join(" ").slice(0, 500);
}

export function msgIncerto(rede: Rede): string {
  return `A Pólia One não teve a resposta do ${NOME_REDE[rede]} sobre esse post. Confere no app antes de agendar de novo, pra ele não sair duas vezes.`;
}

export function msgVencido(rede: Rede): string {
  return `O ${NOME_REDE[rede]} não confirmou a publicação em 2 horas. Confere no app antes de agendar de novo.`;
}

// ── status do post ────────────────────────────────────────────────────────

export type StatusPost = "publicando" | "publicado" | "parcial" | "erro" | "cancelado";

/** O post resume os destinos: tudo saiu, parte saiu, nada saiu. */
export function statusDoPost(destinos: { status: string }[]): StatusPost {
  if (destinos.some((d) => d.status === "pendente" || d.status === "publicando"))
    return "publicando";
  const validos = destinos.filter((d) => d.status !== "cancelado");
  if (validos.length === 0) return "cancelado";
  const saiu = validos.filter((d) => d.status === "publicado").length;
  if (saiu === validos.length) return "publicado";
  return saiu > 0 ? "parcial" : "erro";
}

// ── TikTok ────────────────────────────────────────────────────────────────

/** Vídeo pelo FILE_UPLOAD, num pedaço só (o vídeo vai até 50 MB). */
export function corpoVideoTiktok(legenda: string, e: EscolhasTiktok, bytes: number) {
  if (!e.privacidade) throw new Error("privacidade ausente");
  if (bytes <= 0 || bytes > PEDACO_UNICO_MAX) throw new Error("tamanho fora do pedaço único");
  return {
    post_info: {
      title: legenda,
      privacy_level: e.privacidade,
      disable_comment: !e.permiteComentario,
      disable_duet: !e.permiteDueto,
      disable_stitch: !e.permiteStitch,
      brand_content_toggle: e.conteudoDeMarca,
      brand_organic_toggle: e.marcaPropria,
      is_aigc: e.conteudoIa,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: bytes,
      chunk_size: bytes,
      total_chunk_count: 1,
    },
  };
}

/** Cabeçalho do PUT do pedaço único. */
export function cabecalhoUploadTiktok(mime: string, bytes: number): Record<string, string> {
  return {
    "content-type": mime,
    "content-range": `bytes 0-${bytes - 1}/${bytes}`,
  };
}

/** Fotos só saem por PULL_FROM_URL, de prefixo verificado no portal do TikTok. */
export function corpoFotosTiktok(
  titulo: string | null,
  legenda: string,
  e: EscolhasTiktok,
  urls: string[],
) {
  if (!e.privacidade) throw new Error("privacidade ausente");
  return {
    media_type: "PHOTO",
    post_mode: "DIRECT_POST",
    is_aigc: e.conteudoIa,
    post_info: {
      ...(titulo ? { title: titulo } : {}),
      description: legenda,
      privacy_level: e.privacidade,
      disable_comment: !e.permiteComentario,
      // Sem música automática: ela não escolheu música nenhuma.
      auto_add_music: false,
      brand_content_toggle: e.conteudoDeMarca,
      brand_organic_toggle: e.marcaPropria,
    },
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: urls },
  };
}

export type RespostaTiktok = {
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

const ERROS_PASSAGEIROS_TIKTOK = new Set(["rate_limit_exceeded", "internal_error"]);

const MOTIVO_INIT_TIKTOK: Record<string, string> = {
  spam_risk_too_many_posts:
    "A conta chegou ao limite de posts do dia no TikTok. Agenda de novo pra amanhã.",
  spam_risk_user_banned_from_posting: "O TikTok bloqueou as publicações dessa conta por enquanto.",
  privacy_level_option_mismatch: "Essa opção de privacidade não está mais disponível pra conta.",
  unaudited_client_can_only_post_to_private_accounts:
    "Enquanto a Pólia One não termina a revisão do TikTok, só dá pra postar em conta privada.",
  url_ownership_unverified:
    "O endereço das fotos ainda não foi verificado no TikTok. Post de fotos no TikTok ainda não sai.",
  access_token_invalid: "O acesso ao TikTok caiu. Conecta de novo em Integrações.",
  scope_not_authorized: "O acesso ao TikTok caiu. Conecta de novo em Integrações.",
};

/** Resposta do init: o publish_id, ou o motivo, ou "tenta de novo depois". */
export function leituraInitTiktok(
  r: RespostaTiktok | null,
):
  | { tipo: "ok"; publishId: string; uploadUrl: string | null }
  | { tipo: "erro"; motivo: string }
  | { tipo: "passageiro" } {
  if (!r) return { tipo: "passageiro" };
  const codigo = r.error?.code ?? "ok";
  if (codigo !== "ok") {
    if (ERROS_PASSAGEIROS_TIKTOK.has(codigo)) return { tipo: "passageiro" };
    return {
      tipo: "erro",
      motivo: MOTIVO_INIT_TIKTOK[codigo] ?? "O TikTok recusou o post.",
    };
  }
  const id = r.data?.publish_id;
  if (typeof id !== "string" || !id || id.length > 200)
    return { tipo: "erro", motivo: "O TikTok não devolveu o número do post." };
  const url = r.data?.upload_url;
  return {
    tipo: "ok",
    publishId: id,
    uploadUrl: typeof url === "string" && url.startsWith("https://") ? url : null,
  };
}

const MOTIVO_FALHA_TIKTOK: Record<string, string> = {
  file_format_check_failed: "O TikTok não aceitou o formato do arquivo.",
  duration_check_failed: "O TikTok recusou a duração do vídeo.",
  frame_rate_check_failed:
    "O TikTok recusou o vídeo: ele precisa ter de 23 a 60 quadros por segundo.",
  picture_size_check_failed: "O TikTok recusou o tamanho de uma das fotos.",
  video_pull_failed: "O TikTok não conseguiu baixar o vídeo.",
  photo_pull_failed: "O TikTok não conseguiu baixar as fotos.",
  spam_risk_too_many_posts: "A conta chegou ao limite de posts do dia no TikTok.",
};

export type LeituraStatus =
  | { fase: "esperando" }
  | { fase: "publicado"; postId: string | null }
  | { fase: "erro"; motivo: string };

/**
 * Status do post no TikTok. O id do post é inteiro de 64 bits e perde dígitos
 * no JSON.parse, por isso vem do texto cru (idPostDoTexto).
 */
export function leituraStatusTiktok(r: RespostaTiktok | null, textoCru: string): LeituraStatus {
  if (!r) return { fase: "esperando" };
  const codigo = r.error?.code ?? "ok";
  if (codigo !== "ok") {
    if (ERROS_PASSAGEIROS_TIKTOK.has(codigo) || codigo === "access_token_invalid")
      return { fase: "esperando" };
    return { fase: "erro", motivo: "O TikTok não reconheceu esse post." };
  }
  const status = r.data?.status;
  if (status === "PUBLISH_COMPLETE") return { fase: "publicado", postId: idPostDoTexto(textoCru) };
  if (status === "FAILED") {
    const motivo = String(r.data?.fail_reason ?? "");
    return { fase: "erro", motivo: MOTIVO_FALHA_TIKTOK[motivo] ?? "O TikTok não publicou o post." };
  }
  if (status === "SEND_TO_USER_INBOX")
    return {
      fase: "erro",
      motivo:
        "O TikTok mandou o post pra caixa de entrada do app em vez de publicar. Ele está lá pra publicar à mão.",
    };
  return { fase: "esperando" };
}

/** Primeiro id de "publicaly_available_post_id" (com o erro de grafia da própria API). */
export function idPostDoTexto(texto: string): string | null {
  const m = /"publicaly_available_post_id"\s*:\s*\[\s*"?(\d{1,30})/.exec(texto);
  return m ? m[1] : null;
}

/** Endereço do post. Sem @ seguro ou sem id (post "Só eu"), não tem link. */
export function urlPostTiktok(
  usuario: string | null,
  postId: string | null,
  tipo: TipoPost,
): string | null {
  if (!usuario || !postId || !/^[A-Za-z0-9._]{1,100}$/.test(usuario) || !/^\d+$/.test(postId))
    return null;
  return `https://www.tiktok.com/@${usuario}/${tipo === "video" ? "video" : "photo"}/${postId}`;
}

// ── link da foto que o TikTok baixa ───────────────────────────────────────

export function tokenMidiaValido(t: string | null | undefined): t is string {
  return typeof t === "string" && /^[a-f0-9]{64}$/.test(t);
}

/** Base sem barra no fim; o Worker responde em {base}/{token}. */
export function urlMidiaPublica(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/${token}`;
}

// ── Instagram ─────────────────────────────────────────────────────────────

export type ParametrosContainers = {
  /** Um contêiner por foto do carrossel (vazio fora do carrossel). */
  itens: Record<string, string>[];
  /** O contêiner que vai pro media_publish. No carrossel, falta o children. */
  principal: Record<string, string>;
};

export function containersInstagram(
  tipo: TipoPost,
  legenda: string,
  urls: string[],
): ParametrosContainers {
  if (urls.length === 0) throw new Error("sem mídia");
  if (tipo === "video")
    return {
      itens: [],
      principal: {
        media_type: "REELS",
        video_url: urls[0],
        caption: legenda,
        share_to_feed: "true",
      },
    };
  if (urls.length === 1) return { itens: [], principal: { image_url: urls[0], caption: legenda } };
  return {
    itens: urls.map((u) => ({ image_url: u, is_carousel_item: "true" })),
    principal: { media_type: "CAROUSEL", caption: legenda },
  };
}

/** status_code do contêiner. PUBLISHED aqui é publicação que a Pólia não registrou. */
export function leituraContainerIg(
  statusCode: unknown,
): "pronto" | "esperando" | "erro" | "ja_publicado" {
  if (statusCode === "FINISHED") return "pronto";
  if (statusCode === "ERROR" || statusCode === "EXPIRED") return "erro";
  if (statusCode === "PUBLISHED") return "ja_publicado";
  return "esperando";
}

export type ErroGraph = { code?: number; error_subcode?: number; message?: string };

// Códigos de limite e indisponibilidade da Graph API: tenta de novo depois.
const PASSAGEIROS_GRAPH = new Set([1, 2, 4, 17, 32, 341, 613]);

export function erroGraphPassageiro(e: ErroGraph | null | undefined): boolean {
  return !!e && typeof e.code === "number" && PASSAGEIROS_GRAPH.has(e.code);
}

export function motivoErroInstagram(e: ErroGraph | null | undefined): string {
  if (e?.code === 190) return "O acesso ao Instagram caiu. Conecta de novo em Integrações.";
  if (e?.code === 9 || e?.error_subcode === 2207042)
    return "A conta chegou ao limite de posts do dia no Instagram. Agenda de novo pra amanhã.";
  return "O Instagram recusou o post.";
}
