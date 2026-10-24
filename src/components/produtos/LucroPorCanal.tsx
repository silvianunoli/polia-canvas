import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserMeta } from "@/hooks/useUserMeta";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_MIUDO_ACAO } from "@/lib/botoes";
import { hrefUpgrade, recursoLiberado } from "@/lib/planos";
import { canalQueMaisPesa, linhasPorCanal, lucroDaConta } from "@/lib/precoPorCanal";
import { chaveTaxas, useTaxas } from "@/components/vendas/taxasDados";
import { ModalTaxas } from "@/components/vendas/ModalTaxas";
import { fmt } from "./tipos";

/**
 * "Quanto esse preço deixa em cada forma de receber" (VND-07, Fase 5). Usa as taxas
 * cadastradas em Vendas (ONE-128); o imposto é o da conta da Calculadora e vale
 * igual em todo canal. Premium, como as taxas e Vendas.
 */
export function LucroPorCanal({
  userId,
  preco,
  custo,
  impostosPct,
  taxaContaPct,
}: {
  userId: string | undefined;
  preco: number;
  custo: number;
  impostosPct: number;
  /** Taxa % digitada na conta da Calculadora: base da comparação. */
  taxaContaPct: number;
}) {
  const lucroBase = lucroDaConta({ preco, custo, impostosPct, taxaPct: taxaContaPct });
  const meta = useUserMeta();
  const liberado = !meta.carregando && recursoLiberado("/vendas", meta.plano);
  const qc = useQueryClient();
  const taxasQuery = useTaxas(liberado ? userId : undefined);
  const [taxasAberto, setTaxasAberto] = useState(false);

  const linhas = useMemo(
    () => linhasPorCanal({ preco, custo, impostosPct, lucroBase, taxas: taxasQuery.data ?? {} }),
    [preco, custo, impostosPct, lucroBase, taxasQuery.data],
  );
  const pior = useMemo(() => canalQueMaisPesa(linhas, lucroBase), [linhas, lucroBase]);

  if (meta.carregando) return null;
  if (!liberado) {
    return (
      <p className="mt-4 text-[13px] text-[var(--ink-soft)]">
        No Premium, a Pólia One mostra quanto esse preço deixa no Pix, no cartão, na Shopee e no
        TikTok Shop.{" "}
        <LinkInterno
          href={hrefUpgrade("/vendas")}
          className="font-medium text-[var(--secondary-text)] hover:underline"
        >
          Ver o Premium
        </LinkInterno>
      </p>
    );
  }

  return (
    <section
      aria-labelledby="lucro-por-canal-titulo"
      className="mt-4 rounded-xl border border-[var(--line)] bg-white p-5"
    >
      <h3 id="lucro-por-canal-titulo" className="font-cabinet text-[18px] text-[var(--ink)]">
        Quanto esse preço deixa em cada canal
      </h3>
      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
        {lucroBase > 0
          ? `Nesta conta, a marca lucra ${fmt(lucroBase)}. Com as taxas cadastradas em Vendas e o mesmo imposto, fica assim:`
          : "Com as taxas cadastradas em Vendas e o mesmo imposto desta conta."}
      </p>

      {taxasQuery.isError ? (
        <div role="alert" className="mt-3 text-[14px] text-[var(--danger)]">
          <p>A Pólia One não conseguiu ler as suas taxas agora.</p>
          <button
            type="button"
            onClick={() => void taxasQuery.refetch()}
            className="mt-1 inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : taxasQuery.isLoading ? (
        <p className="mt-3 text-[14px] text-[var(--muted)]">Carregando as taxas…</p>
      ) : linhas.length === 0 ? (
        <div className="mt-3">
          <p className="text-[14px] text-[var(--ink-soft)]">
            Cadastre as taxas dos seus canais (maquininha, link, Shopee, TikTok Shop) pra ver quanto
            a marca lucra em cada um.
          </p>
          <button
            type="button"
            onClick={() => setTaxasAberto(true)}
            disabled={!userId}
            className={`${BTN_MIUDO_ACAO} mt-3 bg-white`}
          >
            Cadastrar taxas
          </button>
        </div>
      ) : (
        <>
          {pior && (
            <p className="mt-4 rounded-lg bg-[var(--surface)] p-3 text-[14px] text-[var(--ink)]">
              {pior.lucro < 0
                ? `${pior.rotulo}: esse preço dá prejuízo de ${fmt(-pior.lucro)} por venda.`
                : `${pior.rotulo}: esse preço deixa ${fmt(pior.lucro)} por venda.`}
              {pior.precoParaMesmoLucro != null &&
                ` Pra lucrar os mesmos ${fmt(lucroBase)}, o preço ali teria que ser ${fmt(pior.precoParaMesmoLucro)}.`}
            </p>
          )}

          <table className="mt-4 w-full text-left text-[13px] sm:text-[14px]">
            <caption className="sr-only">Lucro e preço por canal</caption>
            <thead>
              <tr className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                <th scope="col" className="py-2 pr-2">
                  Canal
                </th>
                <th scope="col" className="hidden py-2 pr-2 sm:table-cell">
                  Taxa
                </th>
                <th scope="col" className="py-2 pr-2 text-right">
                  Lucra
                </th>
                {lucroBase > 0 && (
                  <th scope="col" className="py-2 text-right">
                    Pra lucrar o mesmo
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-t border-[var(--line)]">
                  <td className="py-2 pr-2 text-[var(--ink)]">
                    {l.rotulo}
                    <span className="block text-[12px] text-[var(--muted)] sm:hidden">
                      {l.descricaoTaxa}
                    </span>
                  </td>
                  <td className="hidden py-2 pr-2 text-[var(--ink-soft)] sm:table-cell">
                    {l.descricaoTaxa}
                  </td>
                  <td
                    className={`py-2 pr-2 text-right tabular-nums ${l.lucro < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"}`}
                  >
                    {fmt(l.lucro)}
                  </td>
                  {lucroBase > 0 && (
                    <td className="py-2 text-right tabular-nums text-[var(--ink-soft)]">
                      {l.precoParaMesmoLucro == null
                        ? "taxa + imposto passam de 100%"
                        : fmt(l.precoParaMesmoLucro)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => setTaxasAberto(true)}
            disabled={!userId}
            className="mt-2 inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
          >
            Editar taxas
          </button>
        </>
      )}

      {taxasAberto && userId && (
        <ModalTaxas
          userId={userId}
          onClose={() => setTaxasAberto(false)}
          onSaved={() => {
            setTaxasAberto(false);
            void qc.invalidateQueries({ queryKey: chaveTaxas(userId) });
          }}
        />
      )}
    </section>
  );
}
