import { useMemo } from "react";
import { fmt } from "@/components/produtos/tipos";
import { CANAL_LABEL } from "@/lib/vendas";
import { resumoPorCanal } from "@/lib/precoPorCanal";
import type { VendaLinha } from "./dados";

/**
 * "Por canal" (VND-07, Fase 5): vendas, quanto vendeu, taxa paga e quanto a
 * marca lucrou em cada canal no período. Shopee e TikTok Shop entram aqui
 * quando a integração (Fase 3) trouxer os pedidos.
 */
export function PorCanal({ vendas }: { vendas: VendaLinha[] }) {
  const linhas = useMemo(() => resumoPorCanal(vendas), [vendas]);
  if (linhas.length === 0) return null;
  const semCusto = linhas.reduce((s, l) => s + l.semCusto, 0);

  return (
    <section aria-labelledby="por-canal-titulo" className="mb-6">
      <h3 id="por-canal-titulo" className="font-cabinet text-[18px] text-[var(--ink)]">
        Por canal
      </h3>
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
        <table className="w-full text-left text-[13px] sm:text-[14px]">
          <caption className="sr-only">Vendas, taxa e lucro por canal no período</caption>
          <thead>
            <tr className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              <th scope="col" className="px-3 py-3 sm:px-4">
                Canal
              </th>
              <th scope="col" className="hidden px-3 py-3 text-right sm:table-cell sm:px-4">
                Vendas
              </th>
              <th scope="col" className="px-3 py-3 text-right sm:px-4">
                Vendeu
              </th>
              <th scope="col" className="hidden px-3 py-3 text-right sm:table-cell sm:px-4">
                Taxa paga
              </th>
              <th scope="col" className="px-3 py-3 text-right sm:px-4">
                Lucrou
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.canal} className="border-t border-[var(--line)]">
                <td className="px-3 py-3 text-[var(--ink)] sm:px-4">
                  {CANAL_LABEL[l.canal]}
                  <span className="block text-[12px] text-[var(--muted)] sm:hidden">
                    {l.vendas} {l.vendas === 1 ? "venda" : "vendas"} · taxa {fmt(l.taxa)}
                  </span>
                </td>
                <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell sm:px-4">
                  {l.vendas}
                </td>
                <td className="px-3 py-3 text-right tabular-nums sm:px-4">{fmt(l.vendeu)}</td>
                <td className="hidden px-3 py-3 text-right tabular-nums text-[var(--ink-soft)] sm:table-cell sm:px-4">
                  {fmt(l.taxa)}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums sm:px-4 ${l.lucrou < 0 ? "text-[var(--danger)]" : ""}`}
                >
                  {l.comCusto === 0 ? (
                    <span className="text-[13px] text-[var(--muted)]">sem custo</span>
                  ) : (
                    fmt(l.lucrou)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        Lucrou: o que vendeu menos desconto, taxa e custo. Frete e imposto ficam fora.
      </p>
      {semCusto > 0 && (
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          {semCusto}{" "}
          {semCusto === 1
            ? "venda sem custo cadastrado ficou"
            : "vendas sem custo cadastrado ficaram"}{" "}
          fora do lucro.
        </p>
      )}
    </section>
  );
}
