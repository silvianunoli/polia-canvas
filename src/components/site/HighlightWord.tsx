import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Palavra/trecho com um marcador (grifo) que "pinta" atrás do texto quando
 * entra na tela. Usa --highlight — o único destaque pontual permitido por
 * tela (DESIGN.md). Sem gradiente, só cor sólida.
 */
export function HighlightWord({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[0.06em] top-[0.32em] -z-10 origin-left bg-[var(--highlight)]"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
        transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      />
      <span className="relative text-[var(--highlight-ink)]">{children}</span>
    </span>
  );
}
