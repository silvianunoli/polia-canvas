declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

export function carregarGtag(measurementId: string) {
  if (document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  }
  gtag("js", new Date());
  gtag("config", measurementId);
}

// Dispara um evento GA4 (ex.: ativação). Não faz nada se o GA ainda não
// carregou (sem consentimento) — nunca quebra o app.
export function gtagEvent(nome: string, propriedades?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.dataLayer) return;
  window.dataLayer.push(["event", nome, propriedades ?? {}]);
}
