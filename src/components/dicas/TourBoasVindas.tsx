import { useEffect, useId, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { useDicasVistas } from "@/hooks/useDicasVistas";
import { track } from "@/lib/analytics";
import { PASSOS_TOUR } from "@/lib/dicas";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

/** Primeiro elemento `[data-tour=alvo]` que está de fato na tela. */
function acharAlvo(alvo: string): HTMLElement | null {
  const todos = document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`);
  for (const el of todos) if (el.getClientRects().length > 0) return el;
  return null;
}

/**
 * Âncora no meio da tela, pra quando o alvo está escondido (no celular a
 * sidebar mora num menu fechado). O balão abre logo abaixo dela, sem seta.
 */
const ANCORA_CENTRO = {
  getBoundingClientRect: () => {
    const x = window.innerWidth / 2;
    const y = window.innerHeight * 0.3;
    return DOMRect.fromRect({ x, y, width: 0, height: 0 });
  },
};

/**
 * Tour de 4 balões na primeira chegada ao Painel. Aparece uma vez por conta
 * (ver `useDicasVistas`); "Pular", Esc e "Quero começar" marcam como visto.
 * Clicar fora não fecha: o tour é curto e fechar sem querer não tem volta
 * fácil (só por "Rever o tour", em Configurações).
 */
export function TourBoasVindas() {
  const { mostrar, marcar } = useDicasVistas();
  const ativo = mostrar("tour");
  const [passo, setPasso] = useState(0);
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  const [pronto, setPronto] = useState(false);
  const primarioRef = useRef<HTMLButtonElement>(null);
  const tituloId = useId();

  // Espera o layout assentar (a sidebar confirma a largura num efeito) antes
  // de medir onde está o primeiro alvo.
  useEffect(() => {
    if (!ativo) return;
    const t = window.setTimeout(() => {
      setAlvo(acharAlvo(PASSOS_TOUR[0].alvo));
      setPronto(true);
    }, 400);
    return () => window.clearTimeout(t);
  }, [ativo]);

  // Contorno turquesa no item apontado (estilo em styles.css).
  useEffect(() => {
    if (!alvo) return;
    alvo.setAttribute("data-tour-ativo", "");
    alvo.scrollIntoView({ block: "nearest" });
    return () => alvo.removeAttribute("data-tour-ativo");
  }, [alvo]);

  if (!ativo || !pronto) return null;

  const atual = PASSOS_TOUR[passo];
  const ultimo = passo === PASSOS_TOUR.length - 1;

  // Mede o próximo alvo junto com a troca de passo, pra o balão já nascer no
  // lugar certo em vez de aparecer no centro e pular.
  function avancar() {
    const proximo = passo + 1;
    setAlvo(acharAlvo(PASSOS_TOUR[proximo].alvo));
    setPasso(proximo);
  }

  function encerrar(como: "concluido" | "pulado") {
    void track(como === "concluido" ? "tour_concluido" : "tour_pulado", { passo: passo + 1 });
    // Solta o alvo antes de sumir: o componente continua montado no Painel, e
    // sem isso o contorno turquesa ficava preso no último item apontado.
    setAlvo(null);
    marcar("tour");
  }

  return (
    <PopoverPrimitive.Root open key={passo}>
      <PopoverPrimitive.Anchor virtualRef={{ current: alvo ?? ANCORA_CENTRO }} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={alvo ? atual.lado : "bottom"}
          align={alvo && atual.lado === "bottom" ? "start" : "center"}
          sideOffset={12}
          collisionPadding={16}
          aria-labelledby={tituloId}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            primarioRef.current?.focus();
          }}
          onEscapeKeyDown={() => encerrar("pulado")}
          onInteractOutside={(e) => e.preventDefault()}
          className="polia-v3 z-50 w-[min(320px,calc(100vw-32px))] rounded-xl border border-[var(--line)] bg-white p-5 text-[var(--ink)] shadow-[var(--shadow-card-hover)] outline-none"
          style={TOKEN_BRIDGE_V3}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            {passo + 1} de {PASSOS_TOUR.length}
          </p>
          <h2 id={tituloId} className="font-cabinet mt-2 text-[19px] leading-tight">
            {atual.titulo}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">{atual.texto}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            {ultimo ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={() => encerrar("pulado")}
                className="min-h-9 rounded-lg px-2 text-[13px] text-[var(--secondary-text)] hover:underline"
              >
                Pular
              </button>
            )}
            <button
              ref={primarioRef}
              type="button"
              onClick={() => (ultimo ? encerrar("concluido") : avancar())}
              className="min-h-9 rounded-lg bg-[var(--secondary)] px-4 text-[14px] font-medium text-[var(--secondary-ink)] hover:opacity-90"
            >
              {ultimo ? "Quero começar" : "Próximo"}
            </button>
          </div>
          {alvo && <PopoverPrimitive.Arrow width={14} height={7} className="fill-white" />}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
