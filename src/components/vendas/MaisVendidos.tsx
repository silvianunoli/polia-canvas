import { useMemo, useState } from "react";
import { BTN_MIUDO } from "@/lib/botoes";
import { fmt } from "@/components/produtos/tipos";
import { campeaoDivergente, maisVendidos, type OrdemRanking } from "@/lib/vendas";
import type { VendaLinha } from "./dados";

const ORDENS: { id: OrdemRanking; label: string }[] = [
  { id: "unidades", label: "Unidades" },
  { id: "entrou", label: "Quanto vendeu" },
  { id: "lucrou", label: "Quanto lucrou" },
];

/** Ranking do período: unidades, quanto entrou e quanto lucrou, lado a lado. */
export function MaisVendidos({ vendas }: { vendas: VendaLinha[] }) {
  const [ordem, setOrdem] = useState<OrdemRanking>("unidades");
  const linhas = useMemo(() => maisVendidos(vendas, ordem), [vendas, ordem]);
  const divergente = useMemo(() => campeaoDivergente(linhas), [linhas]);

  if (linhas.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
        Nenhuma venda nesse período. O ranking aparece a partir da primeira.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ordenar por">
        <span className="text-[13px] text-[var(--muted)]">Ordenar por</span>
        {ORDENS.map((o) => {
          const ativo = ordem === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={ativo}
              onClick={() => setOrdem(o.id)}
              className={`${BTN_MIUDO} ${ativo ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {divergente && (
        <p className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[14px] text-[var(--ink)]">
          {divergente.maisSai.produtoNome} é o que mais sai. Quem mais deixou lucro foi{" "}
          {divergente.maisLucra.produtoNome}
          {divergente.diferencaUnidades > 0
            ? `, com ${divergente.diferencaUnidades} ${divergente.diferencaUnidades === 1 ? "unidade" : "unidades"} a menos.`
            : "."}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
        <table className="w-full text-left text-[13px] sm:text-[14px]">
          <caption className="sr-only">Produtos mais vendidos no período</caption>
          <thead>
            <tr className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              <th scope="col" className="hidden w-10 px-3 py-3 sm:px-4 sm:table-cell">
                #
              </th>
              <th scope="col" className="px-3 py-3 sm:px-4">
                Produto
              </th>
              <th scope="col" className="px-3 py-3 sm:px-4 text-right">
                Unid.
              </th>
              <th scope="col" className="px-3 py-3 sm:px-4 text-right">
                Vendido
              </th>
              <th scope="col" className="px-3 py-3 sm:px-4 text-right">
                Lucrou
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => (
              <tr key={l.chave} className="border-t border-[var(--line)]">
                <td className="hidden px-3 py-3 sm:px-4 text-[var(--muted)] sm:table-cell">
                  {idx + 1}
                </td>
                <td className="px-3 py-3 sm:px-4 text-[var(--ink)]">{l.produtoNome}</td>
                <td className="px-3 py-3 sm:px-4 text-right tabular-nums">{l.unidades}</td>
                <td className="px-3 py-3 sm:px-4 text-right tabular-nums">{fmt(l.entrou)}</td>
                <td
                  className={`px-3 py-3 sm:px-4 text-right tabular-nums ${
                    l.lucrou != null && l.lucrou < 0 ? "text-[var(--danger)]" : ""
                  }`}
                >
                  {l.lucrou == null ? (
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
        Desconto e taxa de cada venda são divididos entre os itens pelo valor de cada um. Vendas
        canceladas não entram.
      </p>
    </div>
  );
}
