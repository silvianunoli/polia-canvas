import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatarReais } from "@/lib/formatarReais";
import { estiloNaRegua, pctDaMarca, pctDaMeta, type MarcaDaRegua } from "@/lib/reguaDaMeta";

const fmt = (valor: number) => formatarReais(valor, { sempreCentavos: true });

/**
 * A régua da Meta do mês no Financeiro. Os rótulos moram no fluxo da página,
 * cada marca na sua linha (ONE-171): flutuando sobre o trilho, em tela estreita
 * um cobria o outro e os dois cobriam o título do cartão.
 */
export function ReguaDaMeta({
  entradas,
  metaAlvo,
  marcas,
}: {
  entradas: number;
  metaAlvo: number;
  marcas: readonly MarcaDaRegua[];
}) {
  const metaPct = pctDaMeta(entradas, metaAlvo);

  const reduce = usePrefersReducedMotion();
  const [barOn, setBarOn] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setBarOn(true)));
    return () => cancelAnimationFrame(id);
  }, [reduce]);

  return (
    <div className="mt-4 mb-4">
      {marcas.length > 0 && (
        <div className="mb-3 flex flex-col gap-1">
          {marcas.map((m) => (
            <span
              key={m.chave}
              title={m.detalhe}
              className="relative w-fit max-w-full rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)] transition-colors duration-150 hover:bg-[var(--secondary-light)]"
              style={estiloNaRegua(pctDaMarca(m.num, metaAlvo))}
            >
              {m.rotulo}
            </span>
          ))}
        </div>
      )}
      <div
        className="relative h-3.5 rounded-lg border border-[var(--line)] bg-white"
        role="progressbar"
        aria-valuenow={Math.round(metaPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da Meta do mês"
        aria-valuetext={`${fmt(entradas)} de ${fmt(metaAlvo)}, ${Math.round(metaPct)}% da meta`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          <div
            className={`absolute inset-y-0 left-0 w-full origin-left bg-[var(--secondary)] ${
              reduce
                ? ""
                : "transition-transform duration-[250ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
            }`}
            style={{ transform: `scaleX(${(barOn ? metaPct : 0) / 100})` }}
          />
        </div>
        {marcas.map((m) => (
          <div
            key={m.chave}
            className="absolute -top-1.5 -bottom-1.5 w-[2px] bg-[var(--ink)]"
            style={{ left: `${pctDaMarca(m.num, metaAlvo)}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-col">
        <span
          className="relative w-fit max-w-full rounded-md bg-[var(--highlight)] px-2 py-0.5 text-[12px] font-semibold text-[var(--highlight-ink)]"
          style={estiloNaRegua(metaPct)}
        >
          {fmt(entradas)} entraram até aqui
        </span>
      </div>
    </div>
  );
}
