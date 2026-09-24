declare global {
  interface Window {
    fbq?: PixelFn;
    _fbq?: PixelFn;
  }
}

type PixelFn = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  push: PixelFn;
  queue: unknown[];
  loaded: boolean;
  version: string;
};

export const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

// Dedup de PageView por pathname: o Pixel não redispara sozinho a cada troca
// de rota (diferente do gtag "config", que manda o page_view automático do
// GA4). Quem chama pixelPageView() é o efeito de rota do __root.tsx, e
// também aqui mesmo assim que o Pixel termina de carregar — o dedup evita
// duplicar quando os dois caem no mesmo carregamento inicial.
let ultimaPageViewPathname: string | null = null;

// Carrega o Meta Pixel (uma vez só, mesmo se chamado de novo — ex.: efeito de
// consentimento reagindo à mudança do banner de cookies).
export function carregarPixel(pixelId: string) {
  if (typeof window === "undefined" || window.fbq) return;

  function fbq(...args: unknown[]) {
    const self = fbq as unknown as PixelFn;
    if (self.callMethod) self.callMethod(...args);
    else self.queue.push(args);
  }
  const f = fbq as unknown as PixelFn;
  f.push = f;
  f.loaded = true;
  f.version = "2.0";
  f.queue = [];
  window.fbq = f;
  window._fbq = f;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", pixelId);
  pixelPageView(window.location.pathname);
}

export function pixelPageView(pathname: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (ultimaPageViewPathname === pathname) return;
  ultimaPageViewPathname = pathname;
  window.fbq("track", "PageView");
}

// Lead: só a tela de sucesso do cadastro chama isso, uma vez por inscrição
// nova de verdade (nunca no clique, nunca no submit, nunca no erro). O
// eventId vem do servidor — só existe quando a gravação deu certo — e
// permite deduplicar depois com a API de Conversões. Sem dado pessoal no
// payload: eventID é o único parâmetro.
export function pixelLead(eventId: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "Lead", {}, { eventID: eventId });
}
