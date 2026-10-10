// API de Conversões do Meta (09/10/2026): o servidor avisa o Meta do cadastro,
// sem depender do navegador nem do banner de cookies. O Pixel continua
// disparando o mesmo evento quando há consentimento; os dois levam o MESMO
// event_id, e o Meta conta uma vez só (deduplicação).
//
// Base legal confirmada pela Sil em 09/10/2026. Dado pessoal só vai em hash
// SHA-256 (e-mail e id da conta), como o Meta exige; IP e navegador vão crus
// porque o Meta usa para casar com o clique do anúncio.
//
// Config: secret META_CAPI_TOKEN no Worker (wrangler secret put). Sem ele, nada
// é enviado e nada quebra. META_CAPI_TEST_CODE (opcional) manda os eventos para
// a aba "Testar eventos" do Gerenciador de Eventos em vez da contagem real.

const VERSAO_GRAPH = "v21.0";
const PIXEL_PADRAO = "945253153454733"; // "Polia One", público no HTML do site

export type UsuarioMeta = {
  email?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Cookie _fbp do Pixel (só existe com consentimento). */
  fbp?: string | null;
  /** fb.1.<ms>.<fbclid> montado a partir do clique no anúncio. */
  fbc?: string | null;
};

export type EventoMeta = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: Record<string, string | string[]>;
  custom_data?: Record<string, unknown>;
};

export async function sha256(valor: string): Promise<string> {
  const bytes = new TextEncoder().encode(valor.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** fbclid válido vira o parâmetro fbc no formato que o Meta pede. */
export function fbcDoFbclid(fbclid: string | null | undefined, agoraMs: number): string | null {
  if (!fbclid || !/^[A-Za-z0-9_-]{10,500}$/.test(fbclid)) return null;
  return `fb.1.${agoraMs}.${fbclid}`;
}

export async function montarUserData(u: UsuarioMeta): Promise<Record<string, string | string[]>> {
  const dados: Record<string, string | string[]> = { country: [await sha256("br")] };
  if (u.email) dados.em = [await sha256(u.email)];
  if (u.userId) dados.external_id = [await sha256(u.userId)];
  if (u.ip) dados.client_ip_address = u.ip;
  if (u.userAgent) dados.client_user_agent = u.userAgent;
  if (u.fbp && /^fb\.\d\.\d+\.\d+$/.test(u.fbp)) dados.fbp = u.fbp;
  if (u.fbc) dados.fbc = u.fbc;
  return dados;
}

export type ResultadoEnvio = { enviado: boolean; motivo?: string };

/** Manda os eventos. Nunca joga: falha vira { enviado: false } e log. */
export async function enviarEventosMeta(
  eventos: EventoMeta[],
  fetcher: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { enviado: false, motivo: "sem_token" };
  const pixelId =
    (import.meta.env.VITE_META_PIXEL_ID as string | undefined) || PIXEL_PADRAO;
  const corpo: Record<string, unknown> = { data: eventos };
  const teste = process.env.META_CAPI_TEST_CODE;
  if (teste) corpo.test_event_code = teste;

  try {
    const resp = await fetcher(
      `https://graph.facebook.com/${VERSAO_GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      },
    );
    if (!resp.ok) {
      // Só o status: a resposta do Meta pode ecoar parâmetros da chamada.
      console.error(`[meta-capi] Meta recusou o evento (HTTP ${resp.status}).`);
      return { enviado: false, motivo: `http_${resp.status}` };
    }
    return { enviado: true };
  } catch {
    console.error("[meta-capi] Falha de rede ao enviar evento.");
    return { enviado: false, motivo: "rede" };
  }
}
