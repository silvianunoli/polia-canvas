import { useMemo, useState } from "react";
import { BTN_MIUDO } from "@/lib/botoes";
import { fmt } from "@/components/produtos/tipos";
import { campeaoDivergente, maisVendidos, type OrdemRanking } from "@/lib/vendas";
import { curvaABC, type ClasseABC } from "@/lib/desempenho";
import type { VendaLinha } from "./dados";
import { PorCanal } from "./PorCanal";

const COR_CLASSE: Record<ClasseABC, string> = {
  A: "border-transparent bg-[var(--secondary-light)] text-[var(--ink)]",
  B: "border-transparent bg-[var(--surface)] text-[var(--ink-soft)]",
  C: "border-[var(--line)] bg-white text-[var(--muted)]",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

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
  // Curva ABC (ONE-130): quais produtos sustentam o período.
  const curva = useMemo(() => curvaABC(linhas), [linhas]);
  const doQue = curva.base === "lucrou" ? "do lucro" : "do que a marca vendeu";
  const nomesSemCusto =
    curva.semCusto.length <= 2
      ? curva.semCusto.join(" e ")
      : `${curva.semCusto.slice(0, 2).join(", ")} e mais ${curva.semCusto.length - 2}`;

  if (linhas.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
        Nenhuma venda nesse período. O ranking aparece a partir da primeira.
      </p>
    );
  }

  return (
    <div>
      <PorCanal vendas={vendas} />
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

      {curva.resumo.A.produtos > 0 && linhas.length > 1 && (
        <p className="mt-4 text-[14px] text-[var(--ink-soft)]">
          {curva.resumo.A.produtos === 1
            ? `1 produto (curva A) faz ${pct(curva.resumo.A.parte)} ${doQue} do período`
            : `${curva.resumo.A.produtos} produtos (curva A) fazem ${pct(curva.resumo.A.parte)} ${doQue} do período`}
          {curva.resumo.C.produtos > 0
            ? `; ${curva.resumo.C.produtos} ${curva.resumo.C.produtos === 1 ? "fica" : "ficam"} na curva C, com ${pct(curva.resumo.C.parte)}.`
            : "."}
          {curva.base === "entrou" &&
            curva.semCusto.length > 0 &&
            ` Falta custo em ${nomesSemCusto}, então a curva usa o que a marca vendeu. Com o custo cadastrado, ela passa a usar o lucro.`}
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
              {/* No celular a curva vai como selo ao lado do nome: a sexta coluna estourava 375px. */}
              <th scope="col" className="hidden px-3 py-3 sm:px-4 text-center sm:table-cell">
                Curva
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => (
              <tr key={l.chave} className="border-t border-[var(--line)]">
                <td className="hidden px-3 py-3 sm:px-4 text-[var(--muted)] sm:table-cell">
                  {idx + 1}
                </td>
                <td className="px-3 py-3 sm:px-4 text-[var(--ink)]">
                  {l.produtoNome}
                  {curva.classes.get(l.chave) && (
                    <span
                      aria-label={`curva ${curva.classes.get(l.chave)}`}
                      className={`ml-2 inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-semibold sm:hidden ${COR_CLASSE[curva.classes.get(l.chave)!]}`}
                    >
                      {curva.classes.get(l.chave)}
                    </span>
                  )}
                </td>
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
                <td className="hidden px-3 py-3 sm:px-4 text-center sm:table-cell">
                  {curva.classes.get(l.chave) && (
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${COR_CLASSE[curva.classes.get(l.chave)!]}`}
                    >
                      {curva.classes.get(l.chave)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        Desconto e taxa de cada venda são divididos entre os itens pelo valor de cada um. Vendas
        canceladas não entram. Curva A: os produtos que, somados, chegam a 80% {doQue}; B: os
        seguintes, até 95%; C: o resto, incluindo quem deu prejuízo.
      </p>
    </div>
  );
}
