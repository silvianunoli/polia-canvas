declare global {
  interface Window {
    ttq?: TtqFn;
    TiktokAnalyticsObject?: string;
  }
}

type TtqFn = unknown[] & {
  methods: string[];
  setAndDefer: (alvo: Record<string, unknown>, metodo: string) => void;
  instance: (id: string) => unknown[];
  load: (id: string, opcoes?: Record<string, unknown>) => void;
  page: () => void;
  track: (
    evento: string,
    dados?: Record<string, unknown>,
    opcoes?: Record<string, unknown>,
  ) => void;
  _i?: Record<string, unknown[] & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
};

// ID do pixel não é segredo (vai no HTML de qualquer forma). A variável de
// ambiente só existe pra trocar sem mexer no código.
export const TIKTOK_PIXEL_ID =
  (import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined) || "DB8M643C77UDN3PKVNQG";

// Mesmo dedup do Meta Pixel: ttq.page() não redispara sozinho na troca de
// rota do SPA, quem chama é o efeito de rota do __root.tsx.
let ultimaPagePathname: string | null = null;

// Snippet oficial do TikTok reescrito em TS (mesma fila e mesmos métodos).
// Carrega uma vez só, mesmo se o efeito de consentimento chamar de novo.
export function carregarTiktokPixel(pixelId: string) {
  if (typeof window === "undefined" || window.ttq) return;

  window.TiktokAnalyticsObject = "ttq";
  const ttq = [] as unknown as TtqFn;
  window.ttq = ttq;
  ttq.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ];
  ttq.setAndDefer = (alvo, metodo) => {
    alvo[metodo] = (...args: unknown[]) => {
      (alvo as unknown as unknown[]).push([metodo, ...args]);
    };
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq as unknown as Record<string, unknown>, m);
  ttq.instance = (id) => {
    const e = ttq._i?.[id] ?? [];
    for (const m of ttq.methods) ttq.setAndDefer(e as unknown as Record<string, unknown>, m);
    return e;
  };
  ttq.load = (id, opcoes) => {
    const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i ?? {};
    ttq._i[id] = [];
    ttq._i[id]._u = src;
    ttq._t = ttq._t ?? {};
    ttq._t[id] = Date.now();
    ttq._o = ttq._o ?? {};
    ttq._o[id] = opcoes ?? {};
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = `${src}?sdkid=${id}&lib=ttq`;
    document.head.appendChild(script);
  };

  ttq.load(pixelId);
  tiktokPageView(window.location.pathname);
}

export function tiktokPageView(pathname: string) {
  if (typeof window === "undefined" || !window.ttq) return;
  if (ultimaPagePathname === pathname) return;
  ultimaPagePathname = pathname;
  window.ttq.page();
}

// Os eventos abaixo disparam nos mesmos pontos do Meta Pixel e com o mesmo
// event_id, sem dado pessoal no payload.

export function tiktokLead(eventId: string) {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track("Lead", {}, { event_id: eventId });
}

export function tiktokCadastro(metodo: "email" | "google", eventId?: string) {
  if (typeof window === "undefined" || !window.ttq) return;
  const dados = { content_name: metodo };
  if (eventId) window.ttq.track("CompleteRegistration", dados, { event_id: eventId });
  else window.ttq.track("CompleteRegistration", dados);
}

export function tiktokCompra(valor: number, plano: string, eventId?: string) {
  if (typeof window === "undefined" || !window.ttq) return;
  const dados = { value: valor, currency: "BRL", content_id: plano, content_name: plano };
  if (eventId) window.ttq.track("Purchase", dados, { event_id: eventId });
  else window.ttq.track("Purchase", dados);
}
