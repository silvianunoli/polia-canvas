import { useEffect } from "react";
import { hasConsent } from "@/lib/cookieConsent";
import { carregarTiktokPixel, TIKTOK_PIXEL_ID } from "@/lib/tiktokPixel";

// Mesmo gate do MetaPixel.tsx: só em produção e só depois do aceite de
// cookies de análise, reagindo à troca de consentimento sem recarregar.
export function TiktokPixel() {
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const pixelId = TIKTOK_PIXEL_ID;
    if (typeof window === "undefined" || !pixelId) return;

    const tentarCarregar = () => {
      if (hasConsent("analytics")) carregarTiktokPixel(pixelId);
    };
    tentarCarregar();

    window.addEventListener("polia-cookie-consent-change", tentarCarregar);
    return () => window.removeEventListener("polia-cookie-consent-change", tentarCarregar);
  }, []);

  return null;
}
