import { TIERS_PAGOS, valorDoPlano } from "@/lib/planos";

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
  identify: (dados: Record<string, string>) => void;
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
  despacharViewContentPendente();
}

export function tiktokPageView(pathname: string) {
  if (typeof window === "undefined" || !window.ttq) return;
  if (ultimaPagePathname === pathname) return;
  ultimaPagePathname = pathname;
  window.ttq.page();
}

// ---------------------------------------------------------------------------
// ViewContent automático em página pública (landings de hoje e as que vierem).
// Quem decide se a página é pública é o __root.tsx (rota fora do
// _authenticated); aqui só sai o que nunca é vitrine: cadastro/login,
// páginas legais e telas de pós-ação.
// ---------------------------------------------------------------------------

const FORA_DO_VIEW_CONTENT = [
  "/auth",
  "/privacidade",
  "/termos",
  "/descadastrar",
  "/compra-confirmada",
];

// Nome legível no Events Manager. Página nova sem nome aqui sai com o próprio
// caminho (ex.: "/landing-c"), o que já basta pra separar no relatório.
const NOME_DA_PAGINA: Record<string, string> = {
  "/": "Home",
  "/landing-a": "Landing A",
  "/landing-b": "Landing B",
  "/premium-a": "Landing Premium A",
  "/premium-b": "Landing Premium B",
  "/planos": "Planos",
  "/manual": "Manual",
  "/quiz": "Quiz",
  "/blog": "Blog",
  "/sobre": "Sobre",
  "/ajuda": "Ajuda",
  "/tutorial": "Tutorial",
  "/pesquisa": "Pesquisa",
};

let ultimaViewContent: string | null = null;
// Visitante que chega pelo anúncio vê a landing antes de aceitar os cookies:
// a página fica guardada e sai assim que o pixel carrega.
let viewContentPendente: string | null = null;

function normalizarCaminho(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function paginaRecebeViewContent(pathname: string) {
  const p = normalizarCaminho(pathname);
  return !FORA_DO_VIEW_CONTENT.some((x) => p === x || p.startsWith(`${x}/`));
}

export function tiktokViewContent(pathname: string) {
  if (typeof window === "undefined") return;
  const p = normalizarCaminho(pathname);
  if (!paginaRecebeViewContent(p)) {
    viewContentPendente = null;
    return;
  }
  if (!window.ttq) {
    viewContentPendente = p;
    return;
  }
  if (ultimaViewContent === p) return;
  ultimaViewContent = p;
  const nome = NOME_DA_PAGINA[p] ?? (p.startsWith("/blog/") ? `Blog ${p.slice(6)}` : p);
  window.ttq.track("ViewContent", {
    contents: [{ content_id: p, content_type: "product", content_name: nome }],
  });
}

// ---------------------------------------------------------------------------
// Identificação (ttq.identify). Só hash SHA-256 sai do navegador, nunca o
// e-mail, o telefone ou o id em texto. E o pixel só existe com consentimento.
// ---------------------------------------------------------------------------

export type Quem = { email?: string | null; telefone?: string | null; userId?: string | null };

async function sha256(texto: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Telefone no formato E.164 que o TikTok pede antes do hash (+55DDXXXXXXXXX). */
export function telefoneE164(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55"))
    return `+${digitos}`;
  return null;
}

async function identificar(ttq: TtqFn, quem?: Quem) {
  if (!quem) return;
  const dados: Record<string, string> = {};
  try {
    const email = quem.email?.trim().toLowerCase();
    const fone = quem.telefone ? telefoneE164(quem.telefone) : null;
    const [hEmail, hFone, hId] = await Promise.all([
      email ? sha256(email) : null,
      fone ? sha256(fone) : null,
      quem.userId ? sha256(quem.userId) : null,
    ]);
    if (hEmail) dados.email = hEmail;
    if (hFone) dados.phone_number = hFone;
    if (hId) dados.external_id = hId;
  } catch {
    // Sem hash não tem identify; o evento sai do mesmo jeito.
  }
  if (Object.keys(dados).length) ttq.identify(dados);
}

// identify precisa ir antes do evento; o hash é assíncrono, então o evento
// espera ele (ou a falha dele) pra sair.
function enviar(evento: string, dados: Record<string, unknown>, eventId?: string, quem?: Quem) {
  if (typeof window === "undefined" || !window.ttq) return;
  // A referência fica presa aqui: o hash termina depois, e o evento tem que
  // cair no mesmo pixel em que começou.
  const ttq = window.ttq;
  void identificar(ttq, quem).finally(() => {
    if (eventId) ttq.track(evento, dados, { event_id: eventId });
    else ttq.track(evento, dados);
  });
}

// ---------------------------------------------------------------------------
// Planos. content_id é a chave do plano (controle_mensal etc.), o nome é o
// visível (Premium/Pro): o Events Manager mostra o nome, o id não muda.
// ---------------------------------------------------------------------------

const GRATIS = { content_id: "gratis", content_type: "product", content_name: "Pólia One Grátis" };

function conteudoDoPlano(plano: string) {
  const [tier, ciclo] = plano.split("_");
  const titulo =
    tier === "controle" || tier === "projete" ? TIERS_PAGOS[tier].titulo : (tier ?? plano);
  const nome = `Pólia One ${titulo}${ciclo ? ` ${ciclo}` : ""}`;
  return { content_id: plano, content_type: "product", content_name: nome };
}

function dadosDoPlano(plano: string, valor?: number | null) {
  const v = valor ?? valorDoPlano(plano);
  return {
    contents: [conteudoDoPlano(plano)],
    ...(v !== null && v !== undefined ? { value: v, currency: "BRL" } : {}),
  };
}

/** Clique em qualquer botão que leva ao cadastro grátis. */
export function tiktokCliqueCadastro() {
  enviar("ClickButton", { contents: [GRATIS], value: 0, currency: "BRL" });
}

/** Plano pago escolhido (botão "Quero o Premium/Pro" ou card do /planos). */
export function tiktokEscolheuPlano(plano: string) {
  enviar("AddToCart", dadosDoPlano(plano));
}

/**
 * Clique em link, vindo da delegação do __root.tsx. Pega qualquer botão de
 * landing nova sem instrumentar nada: o destino do link já diz o que é.
 */
export function tiktokCliqueEmLink(href: string) {
  if (typeof window === "undefined") return;
  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return;
  }
  if (url.origin !== window.location.origin) return;
  const p = normalizarCaminho(url.pathname);
  if (p === "/auth/cadastro") {
    tiktokCliqueCadastro();
    return;
  }
  if (p === "/planos") {
    const plano = url.searchParams.get("plano");
    // Sem ?ciclo o /planos abre no mensal; a chave usa o nome interno do plano.
    const ciclo = url.searchParams.get("ciclo") === "anual" ? "anual" : "mensal";
    if (plano === "premium") tiktokEscolheuPlano(`controle_${ciclo}`);
    else if (plano === "pro") tiktokEscolheuPlano(`projete_${ciclo}`);
  }
}

/** Pagamento aberto: formulário do /planos enviado ou checkout do /assinar na tela. */
export function tiktokIniciouCheckout(plano: string, quem?: Quem) {
  enviar("InitiateCheckout", dadosDoPlano(plano), undefined, quem);
}

// Os eventos abaixo disparam nos mesmos pontos do Meta Pixel e com o mesmo
// event_id. Dado pessoal só via identify, em hash.

export function tiktokLead(eventId?: string, quem?: Quem, origem = "manual") {
  enviar(
    "Lead",
    { contents: [{ content_id: origem, content_type: "product", content_name: origem }] },
    eventId,
    quem,
  );
}

export function tiktokCadastro(metodo: "email" | "google", eventId?: string, quem?: Quem) {
  enviar(
    "CompleteRegistration",
    { contents: [GRATIS], value: 0, currency: "BRL", description: metodo },
    eventId,
    quem,
  );
}

export function tiktokCompra(valor: number, plano: string, eventId?: string, quem?: Quem) {
  enviar("Purchase", dadosDoPlano(plano, valor), eventId, quem);
}

// Chamado quando o pixel acaba de carregar (aceite de cookies depois da página).
function despacharViewContentPendente() {
  if (viewContentPendente) {
    const p = viewContentPendente;
    viewContentPendente = null;
    tiktokViewContent(p);
  }
}
