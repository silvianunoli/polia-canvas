import { useEffect, useRef } from "react";
import { MessageCircle, RotateCcw, X } from "lucide-react";

import { track } from "@/lib/analytics";
import { useAssistente } from "./AssistenteContext";
import { ConversaAssistente } from "./ConversaAssistente";

/** Rotas sem o balão: fluxos de tela cheia e a própria página do Assistente. */
const SEM_BALAO = ["/onboarding", "/assinar", "/upgrade", "/aimer"];

/**
 * Assistente em balão no canto inferior direito (05/10/2026, pedido da Sil:
 * saiu da sidebar). Painel não-modal: dá pra ler a tela de trás enquanto
 * conversa. Esc fecha e o foco volta pro botão. O botão é quadrado de cantos
 * arredondados, não círculo: `rounded-full` é reservado a selo não clicável
 * (lib/botoes.ts).
 */
export function AssistenteFlutuante({ pathname }: { pathname: string }) {
  const { aberto, setAberto, mensagens, novaConversa } = useAssistente();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const escondido = SEM_BALAO.some((r) => pathname === r || pathname.startsWith(r + "/"));

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, setAberto]);

  // Navegou pra uma rota sem balão com o painel aberto: fecha.
  useEffect(() => {
    if (escondido && aberto) setAberto(false);
  }, [escondido, aberto, setAberto]);

  if (escondido) return null;

  const alternar = () => {
    const novo = !aberto;
    setAberto(novo);
    if (novo) void track("assistente_aberto", { rota: pathname });
  };

  return (
    <div className="polia-v3">
      {aberto && (
        <div
          role="dialog"
          aria-label="Assistente da Pólia One"
          className="fixed inset-x-3 bottom-[92px] top-20 z-40 flex origin-bottom-right animate-in fade-in-0 zoom-in-95 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow-card-hover)] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] md:inset-auto md:bottom-[92px] md:right-6 md:h-[min(600px,calc(100dvh-140px))] md:w-[400px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-white py-1 pl-4 pr-1">
            <p className="font-cabinet text-[17px] text-[var(--ink)]">Assistente</p>
            <div className="flex items-center">
              {mensagens.length > 0 && (
                <button
                  type="button"
                  onClick={novaConversa}
                  aria-label="Nova conversa"
                  title="Nova conversa"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                >
                  <RotateCcw size={17} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAberto(false);
                  botaoRef.current?.focus();
                }}
                aria-label="Fechar o Assistente"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--ink)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <ConversaAssistente variante="painel" autoFocus />
        </div>
      )}

      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar o Assistente" : "Abrir o Assistente"}
        title={aberto ? undefined : "Assistente"}
        data-tour="aimer"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border-[1.5px] border-[var(--ink)] bg-[var(--secondary)] text-[var(--secondary-ink)] shadow-[var(--shadow-card-hover)] transition-transform duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px"
      >
        {aberto ? (
          <X size={22} aria-hidden="true" />
        ) : (
          <MessageCircle size={22} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
