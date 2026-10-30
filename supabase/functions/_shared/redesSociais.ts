// Regras puras da Agenda das redes (ONE-154): montar a autorização, ler as
// respostas de token do TikTok e do Instagram, decidir o que precisa renovar.
// Sem fetch e sem ambiente: roda igual no Worker (src/lib/redesSociaisApi.ts) e
// nas edge functions (redes-token-renovar), e é o que os testes cobrem.

export type Rede = "tiktok" | "instagram";
export const REDES: readonly Rede[] = ["tiktok", "instagram"];

export function ehRede(valor: unknown): valor is Rede {
  return valor === "tiktok" || valor === "instagram";
}

export const NOME_REDE: Record<Rede, string> = { tiktok: "TikTok", instagram: "Instagram" };

// ── TikTok (Login Kit + Content Posting API) ──────────────────────────────
export const TIKTOK_AUTORIZAR = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_API = "https://open.tiktokapis.com/v2";

// Só os escopos que a Agenda usa: a auditoria recusa escopo pedido e não usado.
// user.info.basic = apelido e foto na tela; video.publish = publicar direto.
export const ESCOPOS_TIKTOK = ["user.info.basic", "video.publish"] as const;

// ── Instagram (API com login do Instagram, conta profissional) ────────────
export const INSTAGRAM_AUTORIZAR = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_TROCA = "https://api.instagram.com/oauth/access_token";
export const INSTAGRAM_GRAPH = "https://graph.instagram.com";
export const INSTAGRAM_VERSAO = "v22.0";
export const ESCOPOS_INSTAGRAM = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

const DIA_MS = 24 * 60 * 60 * 1000;

export function urlAutorizacaoTiktok(p: {
  clientKey: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_key: p.clientKey,
    scope: ESCOPOS_TIKTOK.join(","),
    response_type: "code",
    redirect_uri: p.redirectUri,
    state: p.state,
  });
  return `${TIKTOK_AUTORIZAR}?${q.toString()}`;
}

export function urlAutorizacaoInstagram(p: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: p.appId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: ESCOPOS_INSTAGRAM.join(","),
    state: p.state,
    // Sem isso, quem já tem sessão do Facebook pula a escolha da conta do Instagram.
    enable_fb_login: "0",
    force_authentication: "1",
  });
  return `${INSTAGRAM_AUTORIZAR}?${q.toString()}`;
}

/** O Instagram devolve o code com "#_" no fim; o code de verdade vem antes. */
export function limparCodigoInstagram(code: string): string {
  return code.replace(/#_?$/, "");
}

function emIso(agora: number, segundos: unknown, padraoSegundos: number): string {
  const s = Number(segundos);
  const valido = Number.isFinite(s) && s > 0 ? s : padraoSegundos;
  return new Date(agora + valido * 1000).toISOString();
}

function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const t = String(valor).trim();
  return t ? t.slice(0, max) : null;
}

/** Foto de perfil só entra se for https (a coluna recusa o resto). */
export function fotoSegura(url: unknown): string | null {
  const t = texto(url, 2000);
  return t && t.startsWith("https://") ? t : null;
}

export type TokensTiktok = {
  accessToken: string;
  refreshToken: string;
  accessExpiraEm: string;
  refreshExpiraEm: string;
  openId: string;
  escopos: string;
};

export type RespostaTokenTiktok = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

/**
 * Token do TikTok: o de acesso vale 24 h, o de renovação 365 dias. Erro pode vir
 * com HTTP 200 e o campo `error`: sem os dois tokens e o open_id, é recusa.
 */
export function tokensTiktokDaResposta(
  r: RespostaTokenTiktok | null | undefined,
  agora: number,
): TokensTiktok | null {
  if (!r || r.error || !r.access_token || !r.refresh_token || !r.open_id) return null;
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    accessExpiraEm: emIso(agora, r.expires_in, 86_400),
    refreshExpiraEm: emIso(agora, r.refresh_expires_in, 31_536_000),
    openId: String(r.open_id).slice(0, 100),
    escopos: texto(r.scope, 500) ?? "",
  };
}

/** Faltou escopo na autorização (ela desmarcou na tela do TikTok): não serve. */
export function escoposTiktokCompletos(escopos: string): boolean {
  const dados = new Set(escopos.split(/[,\s]+/).filter(Boolean));
  return ESCOPOS_TIKTOK.every((e) => dados.has(e));
}

export type RespostaTrocaInstagram =
  | { access_token?: string; user_id?: string | number; permissions?: string | string[] }
  | {
      data?: Array<{ access_token?: string; user_id?: string | number; permissions?: string }>;
    };

/** A troca do code devolve o token curto (1 h); às vezes dentro de `data`. */
export function tokenCurtoInstagram(
  r: RespostaTrocaInstagram | null | undefined,
): { accessToken: string; userId: string; escopos: string } | null {
  if (!r) return null;
  const item = "data" in r && Array.isArray(r.data) ? r.data[0] : (r as Record<string, unknown>);
  const accessToken = item?.access_token;
  const userId = texto(item?.user_id, 100);
  if (typeof accessToken !== "string" || !accessToken || !userId) return null;
  const permissoes = item?.permissions;
  const escopos = Array.isArray(permissoes) ? permissoes.join(",") : (texto(permissoes, 500) ?? "");
  return { accessToken, userId, escopos: escopos.slice(0, 500) };
}

export type RespostaTokenLongoInstagram = {
  access_token?: string;
  expires_in?: number;
  error?: unknown;
};

/** Token longo do Instagram: 60 dias, renovável depois de 24 h de vida. */
export function tokenLongoInstagram(
  r: RespostaTokenLongoInstagram | null | undefined,
  agora: number,
): { accessToken: string; accessExpiraEm: string } | null {
  if (!r || r.error || typeof r.access_token !== "string" || !r.access_token) return null;
  return { accessToken: r.access_token, accessExpiraEm: emIso(agora, r.expires_in, 5_184_000) };
}

export function escoposInstagramCompletos(escopos: string): boolean {
  // Resposta sem a lista de permissões não prova que faltou: só barra quando veio.
  if (!escopos) return true;
  const dados = new Set(escopos.split(/[,\s]+/).filter(Boolean));
  return ESCOPOS_INSTAGRAM.every((e) => dados.has(e));
}

export type PerfilRede = {
  contaId: string | null;
  usuario: string | null;
  nome: string | null;
  fotoUrl: string | null;
  /** Instagram: BUSINESS ou MEDIA_CREATOR. Conta pessoal não publica pela API. */
  tipoConta?: string | null;
};

export function perfilTiktokDaResposta(
  info: { data?: { user?: Record<string, unknown> } } | null | undefined,
  criadora: { data?: Record<string, unknown> } | null | undefined,
): PerfilRede {
  const u = info?.data?.user ?? {};
  const c = criadora?.data ?? {};
  return {
    contaId: texto(u.open_id, 100),
    usuario: texto(c.creator_username, 100),
    nome: texto(c.creator_nickname ?? u.display_name, 200),
    fotoUrl: fotoSegura(c.creator_avatar_url ?? u.avatar_url),
  };
}

export function perfilInstagramDaResposta(
  r: Record<string, unknown> | null | undefined,
): PerfilRede {
  return {
    contaId: texto(r?.user_id ?? r?.id, 100),
    usuario: texto(r?.username, 100),
    nome: texto(r?.name, 200),
    fotoUrl: fotoSegura(r?.profile_picture_url),
    tipoConta: texto(r?.account_type, 40),
  };
}

export function contaInstagramProfissional(tipoConta: string | null | undefined): boolean {
  // Sem o campo, a API já recusaria a autorização de conta pessoal: não barra.
  if (!tipoConta) return true;
  return tipoConta === "BUSINESS" || tipoConta === "MEDIA_CREATOR";
}

// ── renovação ─────────────────────────────────────────────────────────────
export type EstadoToken = {
  rede: Rede;
  accessExpiraEm: string | null;
  refreshExpiraEm: string | null;
  renovadoEm: string | null;
};

/**
 * O que o cron diário renova. Instagram: vence em até 20 dias e já tem mais de
 * 24 h (antes disso a Meta recusa). TikTok: a renovação vence em até 30 dias
 * (o token de acesso, de 24 h, é renovado na hora de publicar).
 */
export function precisaRenovarNoCron(t: EstadoToken, agora: number): boolean {
  if (t.rede === "instagram") {
    const vence = t.accessExpiraEm ? Date.parse(t.accessExpiraEm) : NaN;
    const emitido = t.renovadoEm ? Date.parse(t.renovadoEm) : NaN;
    if (!Number.isFinite(vence) || !Number.isFinite(emitido)) return false;
    return vence < agora + 20 * DIA_MS && emitido < agora - DIA_MS && vence > agora;
  }
  const venceRenovacao = t.refreshExpiraEm ? Date.parse(t.refreshExpiraEm) : NaN;
  if (!Number.isFinite(venceRenovacao)) return false;
  return venceRenovacao < agora + 30 * DIA_MS && venceRenovacao > agora;
}

/** Token de acesso a menos de 5 minutos de vencer: renovar antes de usar. */
export function acessoPertoDeVencer(accessExpiraEm: string | null, agora: number): boolean {
  const vence = accessExpiraEm ? Date.parse(accessExpiraEm) : NaN;
  return !Number.isFinite(vence) || vence - agora < 5 * 60 * 1000;
}

export const MSG_RECONECTAR: Record<Rede, string> = {
  tiktok: "A autorização do TikTok venceu. Conecta de novo.",
  instagram: "A autorização do Instagram venceu. Conecta de novo.",
};
