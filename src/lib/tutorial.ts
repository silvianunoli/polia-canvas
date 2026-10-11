// Tutorial narrado "A Pólia One por dentro" (07/10/2026, pedido da Sil).
//
// O vídeo é um HTML em src/assets/tutorial/ (motion com a narração da Roberta;
// o áudio fica em public/video-tutorial/), gerado a partir de
// Desktop/Novo Projeto/polia-one-tutorial por `gerar_versao_app.py`. Mexeu no tutorial lá, roda o script e o app pega a
// versão nova. As telas /como-usar (app) e /tutorial (pública) carregam esse
// HTML num iframe (components/tutorial/PlayerTutorial.tsx). O convite pro
// vídeo no primeiro acesso saiu em 11/10/2026 (ONE-112): no lugar dele, o
// modal curto de components/dicas/BoasVindas.tsx aponta o tutorial no menu.

/** Tela do tutorial dentro do app. A página pública, sem login, é /tutorial. */
export const TUTORIAL_ROTA = "/como-usar";

/** HTML do vídeo pronto pro srcDoc do iframe: liga o modo embutido (sem cabeçalho). */
export function htmlEmbutido(html: string): string {
  return html.replace('<html lang="pt-BR">', '<html lang="pt-BR" class="embed">');
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
