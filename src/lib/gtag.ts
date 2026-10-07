import { hasConsent } from "@/lib/cookieConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

// O gtag.js só executa o que entra no dataLayer como objeto `arguments`.
// Array comum (`...args`) é ignorado em silêncio: nem o config nem os eventos
// chegavam ao GA4. Por isso a função usa `arguments`, igual ao snippet do Google.
function gtag(..._args: unknown[]): void;
function gtag() {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer!.push(arguments);
}

export function carregarGtag(measurementId: string) {
  if (document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  gtag("js", new Date());
  gtag("config", measurementId);
}

// Dispara um evento GA4 (ex.: ativação). Sem consentimento de análise não faz
// nada e nunca quebra o app. Com consentimento, carrega o GA antes se ainda não
// carregou: o useEffect de uma página roda antes do <GoogleAnalytics /> da raiz,
// e o purchase da /compra-confirmada se perdia nessa corrida.
export function gtagEvent(nome: string, propriedades?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!window.dataLayer && MEASUREMENT_ID && hasConsent("analytics")) carregarGtag(MEASUREMENT_ID);
  if (!window.dataLayer) return;
  gtag("event", nome, propriedades ?? {});
}
