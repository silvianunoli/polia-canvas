// Cliente Google Calendar (OAuth2 + Calendar API) — roda só no servidor.
// Requer GOOGLE_CALENDAR_CLIENT_ID / _CLIENT_SECRET / _REDIRECT_URI no ambiente:
// .env em dev, secret do Worker em prod. O secret NUNCA tem prefixo VITE_.

const ESCOPO = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function credenciais() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function montarUrlConsentimento(state: string): { url: string | null; error: string | null } {
  const cred = credenciais();
  if (!cred) return { url: null, error: "A integração com o Google ainda não está configurada." };
  const params = new URLSearchParams({
    client_id: cred.clientId,
    redirect_uri: cred.redirectUri,
    response_type: "code",
    scope: ESCOPO,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, error: null };
}

type TokensGoogle = { access_token: string; refresh_token?: string; expires_in: number };

export async function trocarCodigoPorTokens(
  code: string,
): Promise<{ tokens: TokensGoogle | null; error: string | null }> {
  const cred = credenciais();
  if (!cred) return { tokens: null, error: "A integração com o Google ainda não está configurada." };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cred.clientId,
        client_secret: cred.clientSecret,
        redirect_uri: cred.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) {
      console.error("Google trocarCodigo error:", res.status, await res.text());
      return { tokens: null, error: "Não consegui confirmar a conexão com o Google. Tenta de novo." };
    }
    return { tokens: (await res.json()) as TokensGoogle, error: null };
  } catch (err) {
    console.error("trocarCodigoPorTokens error:", err);
    return { tokens: null, error: "Falha de conexão com o Google." };
  }
}

export async function renovarAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const cred = credenciais();
  if (!cred) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: cred.clientId,
        client_secret: cred.clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      console.error("Google renovarToken error:", res.status, await res.text());
      return null;
    }
    return (await res.json()) as { access_token: string; expires_in: number };
  } catch (err) {
    console.error("renovarAccessToken error:", err);
    return null;
  }
}

export async function buscarEmailConectado(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch (err) {
    console.error("buscarEmailConectado error:", err);
    return null;
  }
}

export interface EventoGoogle {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  diaTodo: boolean;
  link: string | null;
}

type GoogleEventItem = {
  id: string;
  summary?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function listarEventosGoogle(
  accessToken: string,
  timeMinISO: string,
  timeMaxISO: string,
): Promise<{ eventos: EventoGoogle[] | null; error: string | null; expirado: boolean }> {
  try {
    const params = new URLSearchParams({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 401) return { eventos: null, error: null, expirado: true };
    if (!res.ok) {
      console.error("Google listarEventos error:", res.status, await res.text());
      return { eventos: null, error: "Não consegui buscar os eventos do Google agora.", expirado: false };
    }
    const json = (await res.json()) as { items?: GoogleEventItem[] };
    const eventos: EventoGoogle[] = (json.items ?? [])
      .filter((it) => it.start && it.end)
      .map((it) => ({
        id: it.id,
        titulo: it.summary ?? "(sem título)",
        inicio: (it.start!.dateTime ?? it.start!.date) as string,
        fim: (it.end!.dateTime ?? it.end!.date) as string,
        diaTodo: !it.start!.dateTime,
        link: it.htmlLink ?? null,
      }));
    return { eventos, error: null, expirado: false };
  } catch (err) {
    console.error("listarEventosGoogle error:", err);
    return { eventos: null, error: "Falha de conexão com o Google.", expirado: false };
  }
}

export async function revogarToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch (err) {
    console.error("revogarToken error:", err);
  }
}
