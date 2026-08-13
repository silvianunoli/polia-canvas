import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Palavra/trecho com um marcador (grifo) que "pinta" atrás do texto quando
 * entra na tela. Usa --highlight — o único destaque pontual permitido por
 * tela (DESIGN.md). Sem gradiente, só cor sólida.
 *
 * A barra NÃO leva z-index negativo. Elemento com z-index negativo é pintado
 * antes dos fundos dos blocos em volta, então o grifo sumia atrás do fundo da
 * seção; só aparecia por acaso, quando algum ancestral animado criava um
 * contexto de empilhamento que o resgatava. Aqui a barra e o texto são os dois
 * posicionados sem z-index, e a ordem do DOM resolve: barra primeiro, texto
 * depois, texto por cima.
 *
 * Quem é observado é o span de fora, que tem o texto. A barra não serve de alvo
 * porque nasce em scaleX(0), com área zero, e o IntersectionObserver não é
 * confiável para medir elemento sem área.
 *
 * Com prefers-reduced-motion o grifo já aparece pintado, sem varrer.
 */
export function HighlightWord({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduzirMovimento = useReducedMotion();

  return (
    <motion.span
      className="relative inline-block whitespace-nowrap"
      initial="oculto"
      whileInView="pintado"
      viewport={{ once: true, amount: 0.3 }}
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-[0.06em] top-[0.32em] origin-left bg-[var(--highlight)]"
        variants={{
          oculto: { scaleX: reduzirMovimento ? 1 : 0 },
          pintado: { scaleX: 1 },
        }}
        transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      />
      <span className="relative text-[var(--highlight-ink)]">{children}</span>
    </motion.span>
  );
}
