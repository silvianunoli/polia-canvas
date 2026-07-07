import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getCookieConsent, setCookieConsent, type CookieConsentValue } from "@/lib/cookieConsent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getCookieConsent() !== null) return;
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const handle = (value: CookieConsentValue) => {
    setCookieConsent(value);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-live="polite"
          aria-label="Aviso de cookies"
          className="polia-v3 fixed inset-x-0 bottom-0 z-[1000] border-t border-[var(--line)] bg-white px-5 py-5 md:px-6"
        >
          <button
            type="button"
            onClick={() => handle("essential")}
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            <X size={16} aria-hidden="true" />
          </button>

          <div className="mx-auto flex max-w-[1120px] flex-col items-stretch gap-4 pr-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pr-10">
            <div className="min-w-0 flex-1 sm:min-w-[280px]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                Sobre cookies
              </p>
              <p className="mt-1 max-w-[560px] text-[13px] leading-[1.55] text-[var(--muted)]">
                A Pólia usa cookies essenciais pra funcionar e cookies de análise pra entender como
                melhorar a sua experiência. Você controla o que aceita. Leia nossa{" "}
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
                className="rounded-lg border border-[var(--ink)] px-5 py-2.5 text-[14px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-white"
              >
                Só essenciais
              </button>
              <button
                type="button"
                onClick={() => handle("accepted")}
                className="rounded-lg border border-[var(--secondary)] bg-[var(--secondary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--secondary-ink)] transition-[filter] hover:brightness-95"
              >
                Aceitar tudo
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
