// Regras puras do post da Agenda das redes (ONE-155). Sem fetch e sem ambiente:
// o Worker usa ao agendar (src/lib/redesPosts.functions.ts) e o publicador da
// fase 4 (ONE-156) usa de novo antes de enviar, com o creator_info da hora.
//
// As regras do TikTok vêm das Content Sharing Guidelines (lidas em 09/11/2026):
// privacidade escolhida pela dona entre as opções da conta, sem padrão;
// comentário, dueto e stitch desmarcados de início e proibidos quando a conta
// desligou; conteúdo de marca nunca privado; duração máxima da conta. O
// Instagram só aceita foto em JPEG, carrossel até 10 e proporção de 4:5 a 1,91:1.

import type { Rede } from "./redesSociais.ts";

export type TipoPost = "video" | "fotos";

export const PRIVACIDADES_TIKTOK = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
] as const;
export type PrivacidadeTiktok = (typeof PRIVACIDADES_TIKTOK)[number];

export const ROTULO_PRIVACIDADE: Record<PrivacidadeTiktok, string> = {
  PUBLIC_TO_EVERYONE: "Todo mundo",
  FOLLOWER_OF_CREATOR: "Seguidores",
  MUTUAL_FOLLOW_FRIENDS: "Amigos (quem segue a conta e é seguido por ela)",
  SELF_ONLY: "Só eu",
};

export const LEGENDA_MAX = 2200;
export const TITULO_FOTOS_MAX = 90;
// 50 MB: o limite padrão de arquivo do Storage do projeto. Subir depois de conferir no painel.
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const FOTO_MAX_BYTES = 20 * 1024 * 1024;
/** Foto do TikTok: o lado menor até 1080 e o maior até 1920. */
export const FOTO_LADO_MAX = 1080;
export const FOTO_LADO_MAIOR_MAX = 1920;
export const VIDEO_MIN_S = 3;
export const REELS_MAX_S = 15 * 60;
export const FOTOS_MAX_INSTAGRAM = 10;
export const FOTOS_MAX_TIKTOK = 35;
export const AGENDAR_MIN_MS = 5 * 60 * 1000;
export const AGENDAR_MAX_MS = 60 * 24 * 60 * 60 * 1000;
export const MIMES_VIDEO = ["video/mp4", "video/quicktime"] as const;
export const MIME_FOTO = "image/jpeg";

// ── creator_info do TikTok ────────────────────────────────────────────────

export type InfoCriadorTiktok = {
  usuario: string | null;
  nome: string | null;
  fotoUrl: string | null;
  privacidades: PrivacidadeTiktok[];
  comentarioDesligado: boolean;
  duetoDesligado: boolean;
  stitchDesligado: boolean;
  /** Teto de duração de vídeo da conta, em segundos. */
  duracaoMaxS: number | null;
};

export type RespostaCriadorTiktok = {
  data?: Record<string, unknown>;
  error?: { code?: string; message?: string };
};

const MOTIVO_SEM_POSTAR: Record<string, string> = {
  spam_risk_too_many_posts:
    "A conta chegou ao limite de posts do dia no TikTok. Tenta de novo amanhã.",
  spam_risk_user_banned_from_posting: "O TikTok bloqueou as publicações dessa conta por enquanto.",
  reached_active_user_cap:
    "O TikTok não aceita mais contas novas na Pólia hoje. Tenta de novo amanhã.",
};

/**
 * Lê o creator_info. Qualquer código diferente de "ok" quer dizer que a conta
 * não pode postar agora: a tela trava o envio e mostra o motivo.
 */
export function infoCriadorDaResposta(r: RespostaCriadorTiktok | null | undefined): {
  info: InfoCriadorTiktok | null;
  motivo: string | null;
} {
  const codigo = r?.error?.code;
  if (!r || (codigo && codigo !== "ok")) {
    return {
      info: null,
      motivo:
        (codigo && MOTIVO_SEM_POSTAR[codigo]) ??
        "O TikTok não deixou essa conta postar agora. Tenta de novo mais tarde.",
    };
  }
  const d = r.data ?? {};
  const opcoes = Array.isArray(d.privacy_level_options) ? d.privacy_level_options : [];
  const privacidades = PRIVACIDADES_TIKTOK.filter((p) => opcoes.includes(p));
  if (privacidades.length === 0) {
    return {
      info: null,
      motivo: "O TikTok não devolveu nenhuma opção de privacidade pra essa conta.",
    };
  }
  const texto = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const foto = texto(d.creator_avatar_url, 2000);
  const dur = Number(d.max_video_post_duration_sec);
  return {
    info: {
      usuario: texto(d.creator_username, 100),
      nome: texto(d.creator_nickname, 200),
      fotoUrl: foto && foto.startsWith("https://") ? foto : null,
      privacidades,
      comentarioDesligado: d.comment_disabled === true,
      duetoDesligado: d.duet_disabled === true,
      stitchDesligado: d.stitch_disabled === true,
      duracaoMaxS: Number.isFinite(dur) && dur > 0 ? dur : null,
    },
    motivo: null,
  };
}

// ── escolhas do TikTok ────────────────────────────────────────────────────

export type EscolhasTiktok = {
  privacidade: PrivacidadeTiktok | null;
  permiteComentario: boolean;
  permiteDueto: boolean;
  permiteStitch: boolean;
  divulgaMarca: boolean;
  marcaPropria: boolean;
  conteudoDeMarca: boolean;
  conteudoIa: boolean;
};

/** Tudo desligado e sem privacidade: é o começo que as regras do TikTok pedem. */
export const ESCOLHAS_TIKTOK_INICIAIS: EscolhasTiktok = {
  privacidade: null,
  permiteComentario: false,
  permiteDueto: false,
  permiteStitch: false,
  divulgaMarca: false,
  marcaPropria: false,
  conteudoDeMarca: false,
  conteudoIa: false,
};

/** Dueto e stitch não existem em post de fotos; sem divulgação, as duas caixas saem. */
export function normalizarEscolhas(e: EscolhasTiktok, tipo: TipoPost): EscolhasTiktok {
  return {
    ...e,
    permiteDueto: tipo === "video" && e.permiteDueto,
    permiteStitch: tipo === "video" && e.permiteStitch,
    marcaPropria: e.divulgaMarca && e.marcaPropria,
    conteudoDeMarca: e.divulgaMarca && e.conteudoDeMarca,
  };
}

/** Como o TikTok vai rotular o post, pra dona saber antes de publicar. */
export function rotuloComercial(e: EscolhasTiktok): string | null {
  if (!e.divulgaMarca) return null;
  if (e.conteudoDeMarca) return "Parceria paga";
  if (e.marcaPropria) return "Conteúdo promocional";
  return null;
}

/** Conteúdo de marca muda a frase de consentimento (inclui a política de conteúdo de marca). */
export function fraseIncluiPoliticaDeMarca(e: EscolhasTiktok): boolean {
  return e.divulgaMarca && e.conteudoDeMarca;
}

// ── o post ────────────────────────────────────────────────────────────────

export type MidiaPost = {
  ordem: number;
  tipo: "video" | "imagem";
  caminho: string;
  mime: string;
  bytes: number;
  largura: number | null;
  altura: number | null;
  duracaoS: number | null;
};

export type QuandoPost = { modo: "agora" } | { modo: "agendar"; em: string };

export type EntradaPost = {
  postId: string;
  tipo: TipoPost;
  legenda: string;
  titulo: string | null;
  midias: MidiaPost[];
  redes: Rede[];
  tiktok: EscolhasTiktok | null;
  quando: QuandoPost;
  consentiu: boolean;
};

export type ContextoPost = {
  userId: string;
  agora: number;
  conectadas: Rede[];
  criador: InfoCriadorTiktok | null;
};

/** Pasta do post no bucket redes-midias: {user_id}/{post_id}/. */
export function pastaDoPost(userId: string, postId: string): string {
  return `${userId}/${postId}/`;
}

/** Horário em que o post sai: agora, ou o que ela escolheu. null = horário inválido. */
export function horarioDoPost(q: QuandoPost, agora: number): number | null {
  if (q.modo === "agora") return agora;
  const t = Date.parse(q.em);
  return Number.isFinite(t) ? t : null;
}

/**
 * Tudo que impede o post de ser agendado, em frases prontas pra tela. Lista
 * vazia = pode gravar. O servidor roda de novo com o creator_info buscado na
 * hora, então a tela não tem a palavra final.
 */
export function problemasDoPost(p: EntradaPost, ctx: ContextoPost): string[] {
  const erros: string[] = [];
  const redes = [...new Set(p.redes)];
  const temIg = redes.includes("instagram");
  const temTt = redes.includes("tiktok");

  if (!p.consentiu) erros.push("Confirma as escolhas antes de agendar.");
  if (redes.length === 0) erros.push("Escolhe onde o post sai.");
  for (const r of redes) {
    if (!ctx.conectadas.includes(r))
      erros.push(`O ${r === "tiktok" ? "TikTok" : "Instagram"} não está conectado.`);
  }

  if (p.legenda.length > LEGENDA_MAX) erros.push(`A legenda passa de ${LEGENDA_MAX} caracteres.`);
  if (p.titulo && (p.tipo !== "fotos" || !temTt))
    erros.push("O título só vale pra post de fotos no TikTok.");
  if (p.titulo && p.titulo.length > TITULO_FOTOS_MAX)
    erros.push(`O título passa de ${TITULO_FOTOS_MAX} caracteres.`);

  erros.push(...problemasDasMidias(p, ctx, temIg, temTt));

  if (temTt) erros.push(...problemasDoTiktok(p, ctx));
  else if (p.tiktok) erros.push("As escolhas do TikTok vieram sem o TikTok marcado.");

  const quando = horarioDoPost(p.quando, ctx.agora);
  if (quando === null) erros.push("Escolhe um dia e uma hora válidos.");
  else if (p.quando.modo === "agendar") {
    if (quando < ctx.agora + AGENDAR_MIN_MS)
      erros.push("Escolhe um horário pelo menos 5 minutos à frente.");
    if (quando > ctx.agora + AGENDAR_MAX_MS) erros.push("Dá pra agendar até 60 dias à frente.");
  }
  return erros;
}

function problemasDasMidias(
  p: EntradaPost,
  ctx: ContextoPost,
  temIg: boolean,
  temTt: boolean,
): string[] {
  const erros: string[] = [];
  const m = [...p.midias].sort((a, b) => a.ordem - b.ordem);
  const pasta = pastaDoPost(ctx.userId, p.postId);
  if (m.length === 0) return ["Escolhe pelo menos um arquivo."];
  if (m.some((x, i) => x.ordem !== i))
    erros.push("A ordem dos arquivos ficou quebrada. Monta o post de novo.");
  if (m.some((x) => !x.caminho.startsWith(pasta) || x.caminho.includes("..")))
    erros.push("Um dos arquivos não é deste post.");

  if (p.tipo === "video") {
    const v = m[0];
    if (m.length !== 1 || v.tipo !== "video") return [...erros, "Post de vídeo leva um vídeo só."];
    if (!(MIMES_VIDEO as readonly string[]).includes(v.mime))
      erros.push("Use vídeo em MP4 ou MOV.");
    if (v.bytes > VIDEO_MAX_BYTES) erros.push("O vídeo passa de 50 MB.");
    const dur = v.duracaoS ?? 0;
    if (dur < VIDEO_MIN_S) erros.push("O vídeo precisa ter pelo menos 3 segundos.");
    if (temIg && dur > REELS_MAX_S) erros.push("O Instagram aceita Reels de até 15 minutos.");
    const tetoTt = ctx.criador?.duracaoMaxS;
    if (temTt && tetoTt && dur > tetoTt)
      erros.push(`Essa conta do TikTok aceita vídeo de até ${Math.floor(tetoTt)} segundos.`);
    return erros;
  }

  if (m.some((x) => x.tipo !== "imagem"))
    return [...erros, "Post de fotos não leva vídeo no meio."];
  const teto = temIg ? FOTOS_MAX_INSTAGRAM : FOTOS_MAX_TIKTOK;
  if (m.length > teto)
    erros.push(
      temIg
        ? "O Instagram aceita até 10 fotos por post."
        : "O TikTok aceita até 35 fotos por post.",
    );
  if (m.some((x) => x.mime !== MIME_FOTO)) erros.push("As fotos precisam estar em JPEG.");
  if (m.some((x) => x.bytes > FOTO_MAX_BYTES)) erros.push("Uma das fotos passa de 20 MB.");
  const passa = (x: MidiaPost) => {
    const l = x.largura ?? 0;
    const a = x.altura ?? 0;
    return Math.min(l, a) > FOTO_LADO_MAX || Math.max(l, a) > FOTO_LADO_MAIOR_MAX;
  };
  if (m.some(passa)) erros.push("Uma das fotos passa do tamanho que o TikTok aceita.");
  if (temIg) {
    const fora = m.some((x) => {
      if (!x.largura || !x.altura) return true;
      const r = x.largura / x.altura;
      return r < 0.8 - 0.005 || r > 1.91 + 0.005;
    });
    if (fora) erros.push("O Instagram aceita foto de 4:5 (em pé) até 1,91:1 (deitada).");
  }
  return erros;
}

function problemasDoTiktok(p: EntradaPost, ctx: ContextoPost): string[] {
  const c = ctx.criador;
  if (!c) return ["A Pólia One não conseguiu ler a conta do TikTok agora. Tenta de novo."];
  const e = p.tiktok;
  if (!e) return ["Faltam as escolhas do TikTok."];
  const erros: string[] = [];
  if (!e.privacidade) erros.push("Escolhe quem pode ver o post no TikTok.");
  else if (!c.privacidades.includes(e.privacidade))
    erros.push("Essa opção de privacidade não está disponível pra conta agora.");
  if (e.permiteComentario && c.comentarioDesligado)
    erros.push("A conta desligou os comentários no TikTok.");
  if (p.tipo === "fotos" && (e.permiteDueto || e.permiteStitch))
    erros.push("Dueto e stitch só existem em vídeo.");
  if (e.permiteDueto && c.duetoDesligado) erros.push("A conta desligou o dueto no TikTok.");
  if (e.permiteStitch && c.stitchDesligado) erros.push("A conta desligou o stitch no TikTok.");
  if (e.divulgaMarca && !e.marcaPropria && !e.conteudoDeMarca)
    erros.push("Marca se o post divulga a sua marca, a de outra pessoa ou as duas.");
  if (!e.divulgaMarca && (e.marcaPropria || e.conteudoDeMarca))
    erros.push("As opções de divulgação vieram sem a divulgação ligada.");
  if (e.conteudoDeMarca && e.privacidade === "SELF_ONLY")
    erros.push("Conteúdo de marca não pode ficar só pra você.");
  return erros;
}

// ── status na lista ───────────────────────────────────────────────────────

export type StatusDestino = "pendente" | "publicando" | "publicado" | "erro" | "cancelado";

export const ROTULO_STATUS_DESTINO: Record<StatusDestino, string> = {
  pendente: "agendado",
  publicando: "publicando",
  publicado: "publicado",
  erro: "não publicou",
  cancelado: "cancelado",
};

/** Dá pra cancelar enquanto nenhuma rede começou a publicar. */
export function podeCancelar(statusPost: string, destinos: { status: string }[]): boolean {
  return statusPost === "agendado" && destinos.every((d) => d.status === "pendente");
}
