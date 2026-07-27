import { useEffect } from "react";
import { hasConsent } from "@/lib/cookieConsent";
import { DOMINIO_GESTAO } from "@/lib/dominio-gestao";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

function carregarGtag(measurementId: string) {
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
// carregou (sem consentimento ou domínio de gestão) — nunca quebra o app.
export function gtagEvent(nome: string, propriedades?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.dataLayer) return;
  window.dataLayer.push(["event", nome, propriedades ?? {}]);
}

// Só carrega o GA4 se a usuária aceitou cookies de análise (mesmo gate do
// analytics próprio em lib/analytics.ts) — reage à troca de consentimento
// sem precisar recarregar a página. Nunca carrega no domínio de gestão
// (silvianunoli.com.br): é tráfego interno, não da base de clientes.
export function GoogleAnalytics() {
  useEffect(() => {
    if (typeof window === "undefined" || !MEASUREMENT_ID) return;
    if (window.location.hostname === DOMINIO_GESTAO) return;

    const tentarCarregar = () => {
      if (hasConsent("analytics")) carregarGtag(MEASUREMENT_ID);
    };
    tentarCarregar();

    window.addEventListener("polia-cookie-consent-change", tentarCarregar);
    return () => window.removeEventListener("polia-cookie-consent-change", tentarCarregar);
  }, []);

  return null;
}
