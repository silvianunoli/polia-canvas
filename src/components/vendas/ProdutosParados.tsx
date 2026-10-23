import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_MIUDO } from "@/lib/botoes";
import { fmt } from "@/components/produtos/tipos";
import { hojeISO } from "@/lib/data.functions";
import { produtosParados, type ProdutoParado } from "@/lib/desempenho";
import { useProdutosComEstoque, useUltimaVendaPorProduto } from "./dados";

const JANELAS = [30, 60, 90] as const;

function quandoVendeu(p: ProdutoParado): string {
  if (p.diasSemVenda != null) return `última venda há ${p.diasSemVenda} dias`;
  return `cadastrado há ${p.cadastradoHa} dias, nenhuma venda desde então`;
}

/**
 * Produto parado (ONE-130): o que não vende há 30, 60 ou 90 dias e, com
 * estoque ligado e custo, quanto de custo está na prateleira. Benchmark Bling
 * (Sem Movimentação). A última venda vem agregada do banco
 * (ultima_venda_por_produto), sem teto de período.
 */
export function ProdutosParados({ userId }: { userId: string }) {
  const hoje = hojeISO();
  const [dias, setDias] = useState<(typeof JANELAS)[number]>(60);
  const estoqueQuery = useProdutosComEstoque(userId);
  const ultimaQuery = useUltimaVendaPorProduto(userId);

  const parados = useMemo(() => {
    if (!estoqueQuery.data || !ultimaQuery.data) return [];
    return produtosParados(
      estoqueQuery.data.map((p) => ({
        id: p.id,
        nome: p.nome,
        tipo: p.tipo,
        precoCusto: p.precoCusto,
        controlaEstoque: p.controlaEstoque,
        criadoEm: p.criadoEm,
        saldos: p.skus.map((k) => k.saldo),
      })),
      ultimaQuery.data,
      hoje,
      dias,
    );
  }, [estoqueQuery.data, ultimaQuery.data, hoje, dias]);

  const totalParado = parados.reduce((s, p) => s + (p.dinheiroParado ?? 0), 0);
  const algumSemValor = parados.some((p) => p.dinheiroParado == null);
  const catalogoVazio = (estoqueQuery.data ?? []).length === 0;

  return (
    <section aria-labelledby="titulo-parados" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-parados" className="text-[20px] leading-tight text-[var(--ink)]">
            Produtos parados
          </h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            O que não vende há {dias} dias ou mais, em qualquer canal. Serviços e produtos digitais
            ficam de fora.
          </p>
        </div>
        <div role="group" aria-label="Há quanto tempo sem vender" className="flex gap-2">
          {JANELAS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dias === d}
              onClick={() => setDias(d)}
              className={`${BTN_MIUDO} ${dias === d ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {estoqueQuery.isError || ultimaQuery.isError ? (
          <div role="alert">
            <BlockError
              message="A Pólia One não conseguiu ler produtos e vendas agora. Nada foi perdido, é só a leitura que falhou."
              onRetry={() => {
                void estoqueQuery.refetch();
                void ultimaQuery.refetch();
              }}
            />
          </div>
        ) : estoqueQuery.isLoading || ultimaQuery.isLoading ? (
          <p className="text-[14px] text-[var(--muted)]">Procurando produtos parados…</p>
        ) : catalogoVazio ? (
          <p className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
            Ainda não tem produto cadastrado pra comparar.{" "}
            <Link
              to="/produtos"
              className="font-medium text-[var(--secondary-text)] hover:underline"
            >
              Ir para Produtos
            </Link>
          </p>
        ) : parados.length === 0 ? (
          <p className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
            Nada parado: todo produto à venda vendeu nos últimos {dias} dias, está sem estoque ou
            foi cadastrado há menos tempo que isso.
          </p>
        ) : (
          <>
            {totalParado > 0 && (
              <p className="mb-3 text-[14px] text-[var(--ink)]">
                {fmt(totalParado)} de custo parado na prateleira
                {algumSemValor
                  ? ", sem contar os produtos sem custo ou com estoque desligado."
                  : "."}
              </p>
            )}
            <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
              {parados.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-[var(--ink)]">{p.nome}</p>
                    <p className="text-[12px] text-[var(--muted)]">
                      {quandoVendeu(p)}
                      {p.controlaEstoque &&
                        ` · ${p.saldo} ${p.saldo === 1 ? "unidade" : "unidades"} em estoque`}
                    </p>
                  </div>
                  <p className="font-cabinet text-[17px] tabular-nums text-[var(--ink-soft)]">
                    {p.dinheiroParado != null ? (
                      fmt(p.dinheiroParado)
                    ) : (
                      <span className="font-sans text-[13px] text-[var(--muted)]">
                        {p.controlaEstoque ? "sem custo" : "estoque desligado"}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-[var(--muted)]">
              O valor é o custo de cada produto vezes o que ficou no estoque.{" "}
              <Link
                to="/produtos"
                search={{ aba: "estoque" }}
                className="font-medium text-[var(--secondary-text)] hover:underline"
              >
                Ver estoque
              </Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
