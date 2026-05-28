import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PoliaButton } from "@/components/ui/PoliaButton";
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";

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
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-live="polite"
          aria-label="Aviso de cookies"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "rgba(18, 18, 32, 0.97)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "20px 24px",
          }}
        >
          <button
            type="button"
            onClick={() => handle("essential")}
            aria-label="Fechar"
            className="absolute right-3 top-3 rounded p-1 text-[rgba(255,255,255,0.30)] transition-colors hover:text-[rgba(255,255,255,0.70)]"
          >
            <X size={16} />
          </button>

          <div
            className="mx-auto flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            style={{ maxWidth: 1200 }}
          >
            <div className="min-w-0 flex-1 sm:min-w-[280px]">
              <div
                className="font-handwritten"
                style={{
                  fontSize: 17,
                  color: "var(--terracota, #C96B3E)",
                  marginBottom: 4,
                  lineHeight: 1.1,
                }}
              >
                sobre cookies
              </div>
              <p
                className="font-sans"
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.60)",
                  lineHeight: 1.55,
                  maxWidth: 560,
                  margin: 0,
                }}
              >
                A Pólia usa cookies essenciais pra funcionar e cookies de
                análise pra entender como melhorar a sua experiência. Você
                controla o que aceita. Leia nossa{" "}
                <Link
                  to="/privacidade"
                  className="text-[#C96B3E] underline-offset-2 transition-colors hover:text-white hover:underline"
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
                className="font-sans transition-all"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.20)",
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 13,
                  padding: "10px 20px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transitionDuration: "0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.40)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.90)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                }}
              >
                Só essenciais
              </button>
              <PoliaButton onClick={() => handle("accepted")}>
                Aceitar tudo
              </PoliaButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
