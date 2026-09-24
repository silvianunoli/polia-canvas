import { useEffect } from "react";
import { hasConsent } from "@/lib/cookieConsent";
import { carregarPixel, PIXEL_ID } from "@/lib/metaPixel";

// Só carrega o Meta Pixel em produção (nunca em dev, pra não sujar o
// Gerenciador de Eventos com teste local) e só depois que a usuária aceitar
// cookies de análise — mesmo gate do GA4 em GoogleAnalytics.tsx. Reage à
// troca de consentimento sem precisar recarregar a página.
export function MetaPixel() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const pixelId = PIXEL_ID;
    if (typeof window === "undefined" || !pixelId) return;

    const tentarCarregar = () => {
      if (hasConsent("analytics")) carregarPixel(pixelId);
    };
    tentarCarregar();

    window.addEventListener("polia-cookie-consent-change", tentarCarregar);
    return () => window.removeEventListener("polia-cookie-consent-change", tentarCarregar);
  }, []);

  return null;
}
