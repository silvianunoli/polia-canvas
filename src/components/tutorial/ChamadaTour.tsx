import { Link } from "@tanstack/react-router";
import { PlayCircle } from "lucide-react";

import { BTN_ACAO_CONTORNO } from "@/lib/botoes";

/** Fim da lista de tutoriais: o tour de 5 minutos pra quem prefere ver tudo de uma vez. */
export function ChamadaTour({ base }: { base: "/como-usar" | "/tutorial" }) {
  return (
    <section className="mt-16 flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-white p-6 md:flex-row md:items-center md:justify-between md:p-8">
      <div>
        <h2 className="font-cabinet text-[22px] leading-[1.2] tracking-[-0.02em] text-[var(--ink)]">
          Prefere ver tudo de uma vez?
        </h2>
        <p className="mt-1 max-w-[56ch] text-[15px] leading-[1.6] text-[var(--ink-soft)]">
          O tour narrado de 5 minutos passa por todas as telas, com capítulos pra pular direto pra
          parte que interessa.
        </p>
      </div>
      <Link
        to={base === "/como-usar" ? "/como-usar/tour" : "/tutorial/tour"}
        className={`${BTN_ACAO_CONTORNO} shrink-0 max-md:w-full`}
      >
        <PlayCircle size={18} aria-hidden="true" />
        Ver o tour completo
      </Link>
    </section>
  );
}
