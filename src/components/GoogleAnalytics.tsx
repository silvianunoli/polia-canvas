import { useEffect } from "react";
import { hasConsent } from "@/lib/cookieConsent";

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

// Só carrega o GA4 se a usuária aceitou cookies de análise (mesmo gate do
// analytics próprio em lib/analytics.ts) — reage à troca de consentimento
// sem precisar recarregar a página.
export function GoogleAnalytics() {
  useEffect(() => {
    if (typeof window === "undefined" || !MEASUREMENT_ID) return;

    const tentarCarregar = () => {
      if (hasConsent("analytics")) carregarGtag(MEASUREMENT_ID);
    };
    tentarCarregar();

    window.addEventListener("polia-cookie-consent-change", tentarCarregar);
    return () => window.removeEventListener("polia-cookie-consent-change", tentarCarregar);
  }, []);

  return null;
}
