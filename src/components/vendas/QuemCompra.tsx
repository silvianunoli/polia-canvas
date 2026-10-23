import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_MIUDO } from "@/lib/botoes";
import { fmt } from "@/components/produtos/tipos";
import { hojeISO } from "@/lib/data.functions";
import { clientesSumidas, novasERecorrentes } from "@/lib/recorrencia";
import { useComprasPorCliente, type VendaLinha } from "./dados";

const JANELAS = [30, 60, 90] as const;

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Aba "Quem compra" em Vendas (ONE-131): clientes novas contra as que voltaram
 * no período, e a lista de quem comprou e sumiu. Fica em Vendas, e não em
 * Clientes, porque a conta é de compra; a ficha da cliente é do VND-04.
 */
export function QuemCompra({
  userId,
  vendas,
  inicioDoPeriodo,
  canalFiltrado,
}: {
  userId: string;
  /** Vendas do período e do canal escolhidos na página. */
  vendas: VendaLinha[];
  inicioDoPeriodo: string;
  /** Um canal escolhido no filtro (a "primeira compra" continua sendo em qualquer canal). */
  canalFiltrado: boolean;
}) {
  const hoje = hojeISO();
  const [dias, setDias] = useState<(typeof JANELAS)[number]>(60);
  const query = useComprasPorCliente(userId);

  const mapa = useMemo(
    () => new Map((query.data ?? []).map((c) => [c.clienteId, c] as const)),
    [query.data],
  );
  const recorrencia = useMemo(
    () => novasERecorrentes(vendas, mapa, inicioDoPeriodo),
    [vendas, mapa, inicioDoPeriodo],
  );
  const sumidas = useMemo(
    () => (query.data ? clientesSumidas(query.data, hoje, dias) : []),
    [query.data, hoje, dias],
  );
  const vendasValidas = vendas.filter((v) => v.status !== "cancelada").length;

  if (query.isError)
    return (
      <div role="alert">
        <BlockError
          message="A Pólia One não conseguiu ler as compras por cliente agora. Nada foi perdido, é só a leitura que falhou."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  if (query.isLoading)
    return (
      <p role="status" className="text-[14px] text-[var(--muted)]">
        Somando as compras…
      </p>
    );

  const comFicha = recorrencia.novas.total + recorrencia.voltaram.total;
  const parteVoltaram =
    comFicha > 0 ? Math.round((recorrencia.voltaram.total / comFicha) * 100) : 0;
  const ninguemComFicha = recorrencia.novas.clientes + recorrencia.voltaram.clientes === 0;

  return (
    <div>
      <section aria-labelledby="titulo-voltam">
        <h2 id="titulo-voltam" className="text-[20px] leading-tight text-[var(--ink)]">
          Novas e de volta
        </h2>
        {vendasValidas === 0 ? (
          <p className="mt-3 rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
            Nenhuma venda nesse período.
          </p>
        ) : ninguemComFicha ? (
          <p className="mt-3 rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
            Nenhuma venda desse período está ligada a uma ficha de Clientes. Na hora de registrar,
            escolha a cliente da lista e a venda passa a contar aqui.
          </p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--surface)] p-4">
                <dt className="text-[13px] text-[var(--muted)]">Compraram pela primeira vez</dt>
                <dd className="font-cabinet mt-1 text-[24px] text-[var(--ink)]">
                  {recorrencia.novas.clientes}{" "}
                  {recorrencia.novas.clientes === 1 ? "cliente" : "clientes"}
                </dd>
                <dd className="text-[13px] text-[var(--ink-soft)]">
                  {fmt(recorrencia.novas.total)} em compras
                </dd>
              </div>
              <div className="rounded-xl bg-[var(--surface)] p-4">
                <dt className="text-[13px] text-[var(--muted)]">Voltaram a comprar</dt>
                <dd className="font-cabinet mt-1 text-[24px] text-[var(--ink)]">
                  {recorrencia.voltaram.clientes}{" "}
                  {recorrencia.voltaram.clientes === 1 ? "cliente" : "clientes"}
                </dd>
                <dd className="text-[13px] text-[var(--ink-soft)]">
                  {fmt(recorrencia.voltaram.total)} em compras
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
              {parteVoltaram}% do que as clientes com ficha compraram no período veio de quem já
              tinha comprado antes.
            </p>
            {canalFiltrado && (
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                A primeira compra conta em qualquer canal: quem já comprou por outro canal aparece
                como de volta.
              </p>
            )}
          </>
        )}
        {recorrencia.semFicha.vendas > 0 && (
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            {recorrencia.semFicha.vendas}{" "}
            {recorrencia.semFicha.vendas === 1
              ? "venda sem ficha de cliente ficou"
              : "vendas sem ficha de cliente ficaram"}{" "}
            fora da conta ({fmt(recorrencia.semFicha.total)}).
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-sumidas" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titulo-sumidas" className="text-[20px] leading-tight text-[var(--ink)]">
              Clientes sumidas
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Já compraram e não compram há {dias} dias ou mais, em qualquer canal. Não depende do
              período escolhido. Quem mais comprou vem primeiro.
            </p>
          </div>
          <div role="group" aria-label="Há quanto tempo sem comprar" className="flex gap-2">
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
          {(query.data?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
              A lista aparece quando houver vendas ligadas a fichas de cliente.
            </p>
          ) : sumidas.length === 0 ? (
            <p className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
              Nenhuma cliente sumida: todas as clientes com ficha compraram nos últimos {dias} dias.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white">
                {sumidas.map((c) => (
                  <li
                    key={c.clienteId}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-[var(--ink)]">{c.nome}</p>
                      <p className="text-[12px] text-[var(--muted)]">
                        última compra em {dataBR(c.ultimaCompra)}, há {c.diasSemComprar} dias ·{" "}
                        {c.compras} {c.compras === 1 ? "compra" : "compras"}
                      </p>
                    </div>
                    <p className="font-cabinet text-[17px] tabular-nums text-[var(--ink-soft)]">
                      {fmt(c.total)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                O valor soma todas as compras dela, recebidas e a receber.{" "}
                <Link
                  to="/clientes"
                  className="font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Abrir Clientes
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
