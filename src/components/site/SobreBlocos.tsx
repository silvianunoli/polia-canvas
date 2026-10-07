import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Blocos próprios da página /sobre (07/10/2026).
 * Especificação: WIREFRAME-SOBRE-POLIA-ONE.md, na raiz do workspace.
 */

export type ItemLinhaDoTempo = { ano: string; texto: ReactNode };

const entraEmCascata: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.08 } },
};

/**
 * Linha do tempo vertical: quadrado turquesa por item e linha de 2px ligando ao
 * próximo. `motion.ol`/`motion.li` (e não RevealGroup/RevealItem, que são div)
 * pra lista continuar sendo lista pro leitor de tela.
 */
export function LinhaDoTempo({ itens }: { itens: ItemLinhaDoTempo[] }) {
  const reduzir = useReducedMotion();
  const item: Variants = {
    oculto: { opacity: 0, transform: reduzir ? "none" : "translateY(12px)" },
    visivel: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
    },
  };
  return (
    <motion.ol
      className="list-none"
      variants={entraEmCascata}
      initial="oculto"
      whileInView="visivel"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
    >
      {itens.map((it, i) => (
        <motion.li
          key={it.ano}
          variants={item}
          className={`relative border-l-2 pl-8 ${
            i === itens.length - 1 ? "border-transparent" : "border-[var(--line)] pb-6"
          }`}
        >
          <span
            aria-hidden="true"
            className="absolute -left-[7px] top-[5px] h-3 w-3 rounded-[3px] bg-[var(--secondary)]"
          />
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[112px_1fr] sm:gap-4">
            <span className="font-accent pt-[3px] text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
              {it.ano}
            </span>
            <p className="text-[17px] leading-[1.65] text-[var(--ink-soft)] max-md:text-[16px]">
              {it.texto}
            </p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}

type Dado =
  | { rotulo: string; valor: string }
  | { rotulo: string; valor: string; para: "/ajuda" }
  | { rotulo: string; valor: string; href: string; externo?: boolean };

const LINK =
  "inline-flex min-h-[44px] items-center gap-1 font-semibold text-[var(--secondary-text)] underline decoration-1 underline-offset-4 hover:decoration-2";

/** Dados da empresa como documento: rótulo e valor, linha de 1px entre eles. */
export function DadosEmpresa({ dados }: { dados: Dado[] }) {
  return (
    <dl className="rounded-xl border border-[var(--line)] bg-white px-8 py-4 max-md:px-6">
      {dados.map((d, i) => (
        <div key={d.rotulo} className={`py-4 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
          <dt className="font-accent text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
            {d.rotulo}
          </dt>
          <dd className="mt-1 text-[17px] leading-[1.5] text-[var(--ink)]">
            {"para" in d ? (
              <Link to={d.para} className={LINK}>
                {d.valor}
              </Link>
            ) : "href" in d ? (
              <a
                href={d.href}
                className={LINK}
                {...(d.externo ? { target: "_blank", rel: "noopener" } : {})}
              >
                {d.valor}
                {d.externo && (
                  <>
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                    <span className="sr-only"> (abre em nova aba)</span>
                  </>
                )}
              </a>
            ) : (
              d.valor
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
