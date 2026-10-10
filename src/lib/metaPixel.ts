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

// Cadastro grátis concluído (e-mail ou Google): é a conversão que os anúncios
// do Meta otimizam (09/10/2026). Dispara nos mesmos pontos do sign_up do GA4.
// Sem dado pessoal: só o método. O eventId é o mesmo que o servidor manda pela
// API de Conversões (registrarCadastroMeta), pro Meta contar uma vez só.
export function pixelCadastro(metodo: "email" | "google", eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  const dados = { content_name: metodo, status: true };
  if (eventId) window.fbq("track", "CompleteRegistration", dados, { eventID: eventId });
  else window.fbq("track", "CompleteRegistration", dados);
}

/** event_id do cadastro: igual no Pixel e na API de Conversões (dedup no Meta). */
export function eventIdCadastro(userId: string): string {
  return `cadastro_${userId}`;
}

/** Cookie _fbp do Pixel. Só existe se a visitante aceitou os cookies. */
export function lerFbp(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/);
  return m?.[1];
}

// Assinatura paga confirmada. O eventId (session_id do Stripe, quando existe)
// faz o Meta ignorar a mesma compra contada de novo num recarregar da página.
export function pixelCompra(valor: number, plano: string, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  const dados = { value: valor, currency: "BRL", content_name: plano };
  if (eventId) window.fbq("track", "Purchase", dados, { eventID: eventId });
  else window.fbq("track", "Purchase", dados);
}
