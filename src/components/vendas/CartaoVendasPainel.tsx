import { useMemo } from "react";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { fmt } from "@/components/produtos/tipos";
import { contarEstoqueBaixo, intervaloDoPeriodo, maisVendidos, resumoVendas } from "@/lib/vendas";
import { useProdutosComEstoque, useVendas } from "./dados";

/**
 * Cartão do Painel (VND-03): vendas do mês, quanto a marca lucrou, o mais
 * vendido e o estoque baixo. Some enquanto não há venda nem estoque ligado,
 * pra não somar mais um cartão vazio na primeira tela.
 */
export function CartaoVendasPainel({ userId }: { userId: string }) {
  const { de, ate } = useMemo(() => intervaloDoPeriodo("mes", new Date()), []);
  const vendasQuery = useVendas(userId, de, ate);
  const estoqueQuery = useProdutosComEstoque(userId);

  const vendas = useMemo(() => vendasQuery.data ?? [], [vendasQuery.data]);
  const resumo = useMemo(() => resumoVendas(vendas), [vendas]);
  const campeao = useMemo(() => maisVendidos(vendas)[0], [vendas]);
  const baixos = useMemo(
    () =>
      contarEstoqueBaixo(
        (estoqueQuery.data ?? [])
          .filter((p) => p.controlaEstoque)
          .flatMap((p) =>
            p.skus.map((s) => ({ skuId: s.id, saldo: s.saldo, estoqueMinimo: s.estoqueMinimo })),
          ),
      ),
    [estoqueQuery.data],
  );
  const temEstoque = (estoqueQuery.data ?? []).some((p) => p.controlaEstoque);

  if (vendasQuery.isLoading || vendasQuery.isError || estoqueQuery.isLoading) return null;
  if (resumo.quantidade === 0 && !temEstoque) return null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <p className="text-[11px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        Vendas · mês
      </p>
      <p className="font-cabinet mt-1 text-[24px] leading-tight text-[var(--ink)]">
        {resumo.quantidade} {resumo.quantidade === 1 ? "venda" : "vendas"}
        {resumo.quantidade > 0 && <> · a marca lucrou {fmt(resumo.lucrou)}</>}
      </p>
      {resumo.semCusto > 0 && (
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          {resumo.semCusto}{" "}
          {resumo.semCusto === 1
            ? "venda sem custo cadastrado ficou fora da conta"
            : "vendas sem custo cadastrado ficaram fora da conta"}
        </p>
      )}
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        {campeao ? `Mais vendido: ${campeao.produtoNome}` : "Nenhuma venda registrada este mês"}
        {baixos > 0 && (
          <>
            {" "}
            ·{" "}
            <LinkInterno
              href="/produtos?aba=estoque"
              className="font-medium text-[var(--secondary-text)] hover:underline"
            >
              {baixos} {baixos === 1 ? "item com estoque baixo" : "itens com estoque baixo"}
            </LinkInterno>
          </>
        )}{" "}
        ·{" "}
        <LinkInterno
          href="/vendas"
          className="font-medium text-[var(--secondary-text)] hover:underline"
        >
          Ver vendas
        </LinkInterno>
      </p>
    </div>
  );
}
