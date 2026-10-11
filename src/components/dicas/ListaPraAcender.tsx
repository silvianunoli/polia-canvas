import { Check } from "lucide-react";

import type { ItemPraAcender } from "@/lib/painelAcende";

/**
 * Lista "Pra o Painel acender" (11/10/2026, ONE-112). Cada item diz o que ele
 * acende no Painel, então a lista também explica pra que serve cada módulo.
 * Abre com o cadastro e o plano já marcados (progresso real) e some quando os
 * seis estão feitos: o Painel inteiro aceso já é a resposta.
 */
export function ListaPraAcender({ itens }: { itens: ItemPraAcender[] }) {
  const feitos = itens.filter((i) => i.feito).length;
  if (feitos === itens.length) return null;
  const proximo = itens.findIndex((i) => !i.feito);

  return (
    <section
      aria-labelledby="lista-acender-titulo"
      className="mt-8 max-w-[560px] rounded-xl border border-[var(--line)] bg-white p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="lista-acender-titulo" className="font-cabinet text-[17px] leading-tight">
          Pra o Painel acender
        </h2>
        <span className="text-[13px] tabular-nums text-[var(--muted)]">
          {feitos} de {itens.length}
        </span>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
        role="progressbar"
        aria-valuenow={feitos}
        aria-valuemin={0}
        aria-valuemax={itens.length}
        aria-label={`${feitos} de ${itens.length} passos feitos`}
      >
        <span
          className="block h-full w-full origin-left rounded-full bg-[var(--secondary)] transition-transform duration-200 motion-reduce:transition-none"
          style={{ transform: `scaleX(${feitos / itens.length})` }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {itens.map((item, i) => (
          <li
            key={item.id}
            className={`flex gap-3 text-[14px] leading-snug ${
              item.feito
                ? "text-[var(--muted)]"
                : i === proximo
                  ? "font-medium text-[var(--ink)]"
                  : "text-[var(--ink-soft)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] border-[var(--ink)] ${
                item.feito ? "bg-[var(--ink)] text-white" : ""
              }`}
            >
              {item.feito && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="sr-only">{item.feito ? "Feito: " : "Falta: "}</span>
              {item.texto}
              {item.acende && (
                <span className="block text-[13px] font-normal text-[var(--muted)]">
                  {item.acende}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
