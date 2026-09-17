import { useEffect } from "react";
import { hasConsent } from "@/lib/cookieConsent";
import { carregarGtag, MEASUREMENT_ID } from "@/lib/gtag";

// Só carrega o GA4 se a usuária aceitou cookies de análise (mesmo gate do
// analytics próprio em lib/analytics.ts) — reage à troca de consentimento
// sem precisar recarregar a página.
export function GoogleAnalytics() {
  useEffect(() => {
    const measurementId = MEASUREMENT_ID;
    if (typeof window === "undefined" || !measurementId) return;

    const tentarCarregar = () => {
      if (hasConsent("analytics")) carregarGtag(measurementId);
    };
    tentarCarregar();

    window.addEventListener("polia-cookie-consent-change", tentarCarregar);
    return () => window.removeEventListener("polia-cookie-consent-change", tentarCarregar);
  }, []);

  return null;
}
