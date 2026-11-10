// Chamadas HTTP do publicador da Agenda das redes (ONE-156). Sem ambiente e sem
// banco: a edge function redes-publicar passa o token. null = não deu pra falar
// com a rede (rede fora, prazo estourado); resposta com erro volta como veio,
// pra regra em redesPublicar.ts decidir. Nenhum token vai para log.

import { INSTAGRAM_GRAPH, INSTAGRAM_VERSAO, TIKTOK_API } from "./redesSociais.ts";
import type { ErroGraph, RespostaTiktok } from "./redesPublicar.ts";

const PRAZO_MS = 30_000;
/** Subir até 50 MB pede mais folga que uma chamada comum. */
const PRAZO_UPLOAD_MS = 120_000;

export type RespostaCrua<T> = { json: T | null; texto: string; status: number };

async function crua<T>(res: Response): Promise<RespostaCrua<T>> {
  const texto = await res.text().catch(() => "");
  let json: T | null = null;
  try {
    json = texto ? (JSON.parse(texto) as T) : null;
  } catch {
    json = null;
  }
  return { json, texto, status: res.status };
}

// ── TikTok ────────────────────────────────────────────────────────────────

async function postTiktok(
  token: string,
  caminho: string,
  corpo: unknown,
): Promise<RespostaCrua<RespostaTiktok> | null> {
  try {
    const res = await fetch(`${TIKTOK_API}${caminho}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    return await crua<RespostaTiktok>(res);
  } catch {
    return null;
  }
}

export function iniciarVideoTiktok(token: string, corpo: unknown) {
  return postTiktok(token, "/post/publish/video/init/", corpo);
}

export function iniciarFotosTiktok(token: string, corpo: unknown) {
  return postTiktok(token, "/post/publish/content/init/", corpo);
}

export function statusPostTiktok(token: string, publishId: string) {
  return postTiktok(token, "/post/publish/status/fetch/", { publish_id: publishId });
}

/** PUT do vídeo inteiro no upload_url. true = o TikTok recebeu (201 ou 206). */
export async function subirVideoTiktok(
  uploadUrl: string,
  arquivo: Blob,
  cabecalho: Record<string, string>,
): Promise<boolean | null> {
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: cabecalho,
      body: arquivo,
      signal: AbortSignal.timeout(PRAZO_UPLOAD_MS),
    });
    await res.body?.cancel();
    if (res.status !== 201 && res.status !== 206) console.warn("TikTok upload:", res.status);
    return res.status === 201 || res.status === 206;
  } catch {
    return null;
  }
}

// ── Instagram ─────────────────────────────────────────────────────────────

export type RespostaGraph = { id?: string; error?: ErroGraph } & Record<string, unknown>;

export async function graphPost(
  token: string,
  caminho: string,
  parametros: Record<string, string>,
): Promise<RespostaGraph | null> {
  try {
    const res = await fetch(`${INSTAGRAM_GRAPH}/${INSTAGRAM_VERSAO}/${caminho}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...parametros, access_token: token }).toString(),
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    const r = await crua<RespostaGraph>(res);
    if (r.json?.error)
      console.warn("Instagram POST:", res.status, r.json.error.code, r.json.error.error_subcode);
    return r.json ?? { error: { message: `status ${res.status}` } };
  } catch {
    return null;
  }
}

export async function graphGet(
  token: string,
  id: string,
  campos: string,
): Promise<RespostaGraph | null> {
  // O token vai na URL porque é assim que a Meta define a leitura (GET).
  const q = new URLSearchParams({ fields: campos, access_token: token });
  try {
    const res = await fetch(
      `${INSTAGRAM_GRAPH}/${INSTAGRAM_VERSAO}/${encodeURIComponent(id)}?${q.toString()}`,
      { signal: AbortSignal.timeout(PRAZO_MS) },
    );
    const r = await crua<RespostaGraph>(res);
    return r.json ?? { error: { message: `status ${res.status}` } };
  } catch {
    return null;
  }
}
