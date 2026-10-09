// Tutorial narrado "A Pólia One por dentro" (07/10/2026, pedido da Sil).
//
// O vídeo é um HTML em src/assets/tutorial/ (motion com a narração da Roberta;
// o áudio fica em public/video-tutorial/), gerado a partir de
// Desktop/Novo Projeto/polia-one-tutorial por `gerar_versao_app.py`. Mexeu no tutorial lá, roda o script e o app pega a
// versão nova. As telas /como-usar (app) e /tutorial (pública) carregam esse
// HTML num iframe (components/tutorial/PlayerTutorial.tsx); o convite do
// primeiro acesso mora em components/dicas/ConviteTutorial.tsx.

/** Tela do tutorial dentro do app. A página pública, sem login, é /tutorial. */
export const TUTORIAL_ROTA = "/como-usar";

/**
 * Telas onde o convite GLOBAL não abre: fluxo de entrada, upgrade, o próprio tutorial
 * e a Calculadora. O onboarding termina em "Quero calcular meu primeiro preço" e
 * cai na Calculadora; o convite de 5 minutos por cima, junto com a dica da
 * tela, interrompia justo quem pediu pra calcular (ONE-101). Ele abre na tela
 * seguinte.
 */
const SEM_CONVITE = ["/onboarding", "/assinar", "/upgrade", TUTORIAL_ROTA, "/calculadora"];

// O onboarding tem convite próprio, só na tela de boas-vindas (09/10/2026):
// ConviteTutorial com `naEntrada`, que toca o vídeo ali mesmo.
export function rotaAceitaConvite(pathname: string): boolean {
  return !SEM_CONVITE.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

/** HTML do vídeo pronto pro srcDoc do iframe: liga o modo embutido (sem cabeçalho). */
export function htmlEmbutido(html: string): string {
  return html.replace('<html lang="pt-BR">', '<html lang="pt-BR" class="embed">');
}

// O lembrete diário do Planejamento não abre no mesmo carregamento em que o
// convite apareceu: dois modais seguidos na entrada é demais. Fica em memória
// (some no reload) porque só precisa valer pra esta visita.
let conviteAbertoNestaVisita = false;
export function marcarConviteAberto() {
  conviteAbertoNestaVisita = true;
}
export function conviteFoiAberto() {
  return conviteAbertoNestaVisita;
}

export type MensagemTutorial =
  | { tipo: "altura"; altura: number }
  | { tipo: "evento"; evento: "play" | "fim" }
  | { tipo: "cheia"; ativo: boolean }
  | null;

/** Lê o que o iframe do vídeo mandou por postMessage; qualquer outra coisa vira null. */
export function lerMensagemTutorial(dado: unknown): MensagemTutorial {
  if (!dado || typeof dado !== "object") return null;
  const m = dado as { tipo?: unknown; altura?: unknown; evento?: unknown; ativo?: unknown };
  if (m.tipo === "polia-tutorial-altura") {
    const h = m.altura;
    if (typeof h !== "number" || !Number.isFinite(h) || h < 200 || h > 6000) return null;
    return { tipo: "altura", altura: Math.ceil(h) };
  }
  if (m.tipo === "polia-tutorial-evento" && (m.evento === "play" || m.evento === "fim")) {
    return { tipo: "evento", evento: m.evento };
  }
  // Tela cheia própria do vídeo (quando o navegador recusa a de verdade, como no
  // iPhone): o app abre o iframe por cima da tela toda.
  if (m.tipo === "polia-tutorial-cheia" && typeof m.ativo === "boolean") {
    return { tipo: "cheia", ativo: m.ativo };
  }
  return null;
}
