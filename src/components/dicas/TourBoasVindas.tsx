import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { useDicasVistas } from "@/hooks/useDicasVistas";
import { track } from "@/lib/analytics";
import { BTN_ACAO } from "@/lib/botoes";
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
 * Balão de primeira chegada ao Painel (11/10/2026, ONE-112): um só, sem
 * "Próximo". Ele aponta o Planejamento e avança quando ela clica no item, que
 * leva direto pro módulo em andamento (`modulo`; null com os 6 fechados). Era um tour de três balões
 * com "Próximo, Próximo, Quero começar": a usuária terminava sem ter feito nada.
 *
 * Abre depois das boas-vindas (BoasVindas marca "boas-vindas"). "Pular" e Esc
 * marcam o tour como visto. Clicar fora não fecha: fechar sem querer não tem
 * volta fácil (só por "Rever o tour", em Configurações). No celular, com o
 * menu fechado, o balão fica no meio da tela com um botão que faz o caminho.
 */
export function TourBoasVindas({ modulo }: { modulo: number | null }) {
  const { mostrar, marcar } = useDicasVistas();
  const navigate = useNavigate();
  const ativo = mostrar("tour") && !mostrar("boas-vindas");
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  const [pronto, setPronto] = useState(false);
  const pularRef = useRef<HTMLButtonElement>(null);
  const tituloId = useId();
  const passo = PASSOS_TOUR[0];

  // Espera o layout assentar (a sidebar confirma a largura num efeito, e o
  // modal de boas-vindas precisa terminar de fechar) antes de medir o alvo.
  useEffect(() => {
    if (!ativo) return;
    const t = window.setTimeout(() => {
      setAlvo(acharAlvo(passo.alvo));
      setPronto(true);
    }, 400);
    return () => window.clearTimeout(t);
  }, [ativo, passo.alvo]);

  // O clique no item apontado é o "próximo": marca o tour e vai pro módulo em
  // andamento, em vez da lista de módulos (um clique a menos até a 1ª seção).
  useEffect(() => {
    if (!ativo || !alvo) return;
    alvo.setAttribute("data-tour-ativo", "");
    alvo.scrollIntoView({ block: "nearest" });
    const aoClicar = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      seguir("alvo");
    };
    alvo.addEventListener("click", aoClicar, true);
    return () => {
      alvo.removeEventListener("click", aoClicar, true);
      alvo.removeAttribute("data-tour-ativo");
    };
    // `seguir` muda a cada render; o efeito só precisa refazer quando o alvo muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, alvo]);

  if (!ativo || !pronto) return null;

  function seguir(como: "alvo" | "botao") {
    void track("tour_concluido", { como });
    setAlvo(null);
    marcar("tour");
    if (modulo === null) void navigate({ to: "/planejamento" });
    else
      void navigate({
        to: "/planejamento/modulo/$n",
        params: { n: String(modulo) },
        search: { secao: undefined },
      });
  }

  function pular() {
    void track("tour_pulado", { passo: 1 });
    // Solta o alvo antes de sumir: o componente continua montado no Painel, e
    // sem isso o contorno turquesa ficava preso no item apontado.
    setAlvo(null);
    marcar("tour");
  }

  return (
    <PopoverPrimitive.Root open>
      <PopoverPrimitive.Anchor virtualRef={{ current: alvo ?? ANCORA_CENTRO }} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={alvo ? passo.lado : "bottom"}
          align="center"
          sideOffset={12}
          collisionPadding={16}
          aria-labelledby={tituloId}
          onOpenAutoFocus={(e) => {
            // Sem botão principal quando o alvo está visível: o foco vai pro
            // "Pular", e o teclado chega no item do menu pelo Tab normal.
            e.preventDefault();
            pularRef.current?.focus();
          }}
          onEscapeKeyDown={pular}
          onInteractOutside={(e) => e.preventDefault()}
          // Nasce do item apontado (origin do Radix), 200ms com ease-out forte.
          // Com "reduzir movimento" o zoom some e fica só o fade (styles.css).
          className="polia-v3 z-50 w-[min(320px,calc(100vw-32px))] origin-(--radix-popover-content-transform-origin) animate-in fade-in-0 zoom-in-95 rounded-xl border border-[var(--line)] bg-white p-5 text-[var(--ink)] shadow-[var(--shadow-card-hover)] outline-none duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={TOKEN_BRIDGE_V3}
        >
          <h2 id={tituloId} className="font-cabinet text-[19px] leading-tight">
            {passo.titulo}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
            {alvo ? passo.texto : (passo.textoSemAlvo ?? passo.texto)}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              ref={pularRef}
              type="button"
              onClick={pular}
              className="-my-1 min-h-11 rounded-lg px-2 text-[13px] text-[var(--secondary-text)] hover:underline"
            >
              Pular
            </button>
            {!alvo && (
              <button type="button" onClick={() => seguir("botao")} className={BTN_ACAO}>
                Abrir o Planejamento
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          {alvo && <PopoverPrimitive.Arrow width={14} height={7} className="fill-white" />}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
