import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Revela o conteúdo com um leve movimento quando entra na tela.
 * Respeita prefers-reduced-motion (motion.reduce vira só fade).
 */
export function Reveal({
  children,
  delay = 0,
  y = 22,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "span";
}) {
  const reduceMotion = useReducedMotion();
  const Comp = motion[as];

  return (
    <Comp
      className={className}
      initial={{
        opacity: 0,
        transform: reduceMotion ? "translateY(0px)" : `translateY(${y}px)`,
      }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, transform: "translateY(16px)" },
  show: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Container que revela os filhos em cascata (stagger) ao entrar na tela. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

/** Título grande que entra linha a linha (cada linha é um elemento separado). */
export function RevealLines({
  lines,
  className,
  lineClassName,
  as = "div",
}: {
  lines: string[];
  className?: string;
  lineClassName?: string;
  as?: "div" | "h1" | "h2";
}) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
    >
      {lines.map((line, i) => (
        <div key={i} className="overflow-hidden">
          <motion.span
            className={lineClassName}
            style={{ display: "block" }}
            variants={{
              hidden: { transform: "translateY(100%)", opacity: 0 },
              show: {
                transform: "translateY(0%)",
                opacity: 1,
                transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          >
            {line}
          </motion.span>
        </div>
      ))}
    </Comp>
  );
}
