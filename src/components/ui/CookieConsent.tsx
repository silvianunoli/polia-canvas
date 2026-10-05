import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getCookieConsent, setCookieConsent, type CookieConsentValue } from "@/lib/cookieConsent";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";

// Mesmos seletores de sempre pra achar o que é focável dentro do aviso —
// não tem primitive de Dialog reutilizável aqui (é uma barra no rodapé, sem
// overlay, não um modal de tela cheia), então a prisão de foco é feita à mão.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getCookieConsent() !== null) return;
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Ao aparecer, guarda quem tinha foco e manda o foco pro primeiro elemento
  // focável do aviso (mesma ideia do headingRef de ErrorPage.tsx); ao sumir,
  // devolve o foco pra quem tinha antes.
  useEffect(() => {
    if (!visible) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const first = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    first?.focus();
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [visible]);

  // Prende o Tab dentro do aviso enquanto ele estiver visível: no limite,
  // Tab/Shift+Tab volta pro outro extremo em vez de escapar pro resto da
  // página.
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusables = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible]);

  const handle = (value: CookieConsentValue) => {
    setCookieConsent(value);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={containerRef}
          initial={{
            transform: reduceMotion ? "translateY(0px)" : "translateY(40px)",
            opacity: 0,
          }}
          animate={{
            transform: "translateY(0px)",
            opacity: 1,
            transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
          }}
          exit={{
            transform: reduceMotion ? "translateY(0px)" : "translateY(40px)",
            opacity: 0,
            transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
          }}
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-label="Aviso de cookies"
          className="polia-v3 fixed inset-x-0 bottom-0 z-[1000] border-t border-[var(--line)] bg-white px-5 py-5 md:px-6"
        >
          <button
            type="button"
            onClick={() => handle("essential")}
            aria-label="Fechar"
            className="absolute right-1 top-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            <X size={16} aria-hidden="true" />
          </button>

          <div className="mx-auto flex max-w-[1120px] flex-col items-stretch gap-4 pr-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pr-10">
            <div className="min-w-0 flex-1 sm:min-w-[280px]">
              <p className="text-[13px] font-accent font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                Sobre cookies
              </p>
              <p className="mt-1 max-w-[560px] text-[13px] leading-[1.55] text-[var(--muted)]">
                A Pólia usa cookies essenciais pra funcionar e cookies de análise pra entender como
                melhorar a experiência. O controle do que é aceito fica com quem usa. Leia nossa{" "}
                <Link
                  to="/privacidade"
                  className="text-[var(--ink)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px]"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => handle("essential")}
                className={BTN_ACAO_CONTORNO}
              >
                Só essenciais
              </button>
              <button type="button" onClick={() => handle("accepted")} className={BTN_ACAO}>
                Aceitar tudo
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
