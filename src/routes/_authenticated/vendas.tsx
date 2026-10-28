import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import { ModalTaxas } from "@/components/vendas/ModalTaxas";
import { chaveTaxas } from "@/components/vendas/taxasDados";
import { fmt, fmtData } from "@/components/produtos/tipos";
import {
  CANAIS_VENDA,
  CANAL_LABEL,
  contarEstoqueBaixo,
  intervaloDoPeriodo,
  lucroDaVenda,
  resumoVendas,
  type CanalVenda,
  type PeriodoVendas,
} from "@/lib/vendas";
import {
  chaveEstoque,
  chaveVendas,
  useProdutosComEstoque,
  useVendas,
  type VendaLinha,
} from "@/components/vendas/dados";
import { ModalRegistrarVenda } from "@/components/vendas/ModalRegistrarVenda";
import { ModalVenda } from "@/components/vendas/ModalVenda";
import { MaisVendidos } from "@/components/vendas/MaisVendidos";
import { ProdutosParados } from "@/components/vendas/ProdutosParados";
import { QuemCompra } from "@/components/vendas/QuemCompra";
import { ListaOrcamentos } from "@/components/orcamentos/ListaOrcamentos";
import { chaveOrcamentos, useOrcamentos } from "@/components/orcamentos/dados";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas · Pólia One" },
      {
        name: "description",
        content: "O que saiu, por onde e quanto a marca lucrou.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { aba?: "orcamentos" } => ({
    aba: search.aba === "orcamentos" ? "orcamentos" : undefined,
  }),
  component: VendasPage,
});

const PERIODOS: { id: PeriodoVendas; label: string }[] = [
  { id: "mes", label: "Este mês" },
  { id: "passado", label: "Mês passado" },
  { id: "90dias", label: "Últimos 90 dias" },
];

type Aba = "pedidos" | "ranking" | "clientes" | "orcamentos";

function VendasPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const search = Route.useSearch();

  // ?aba=orcamentos vem do e-mail de orçamento aprovado (ONE-129).
  const [aba, setAba] = useState<Aba>(search.aba ?? "pedidos");
  const [periodo, setPeriodo] = useState<PeriodoVendas>("mes");
  const [canal, setCanal] = useState<CanalVenda | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [registrarAberto, setRegistrarAberto] = useState(false);
  const [vendaAberta, setVendaAberta] = useState<VendaLinha | null>(null);
  const [taxasAbertas, setTaxasAbertas] = useState(false);
  const [novoOrcamento, setNovoOrcamento] = useState(false);
  // Aprovados pela cliente aparecem no rótulo da aba: é o que pede ação.
  const orcamentosQuery = useOrcamentos(userId);
  const aprovados = (orcamentosQuery.data ?? []).filter((o) => o.status === "aprovado").length;

  const { de, ate } = useMemo(() => intervaloDoPeriodo(periodo, new Date()), [periodo]);
  const vendasQuery = useVendas(userId, de, ate);
  const estoqueQuery = useProdutosComEstoque(userId);

  const vendas = useMemo(() => vendasQuery.data ?? [], [vendasQuery.data]);
  const doCanal = useMemo(
    () => (canal === "todos" ? vendas : vendas.filter((v) => v.canal === canal)),
    [vendas, canal],
  );
  const filtradas = useMemo(() => {
    const alvo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!alvo) return doCanal;
    return doCanal.filter(
      (v) =>
        (v.clienteNome ?? "").toLocaleLowerCase("pt-BR").includes(alvo) ||
        v.itens.some((i) => i.produtoNome.toLocaleLowerCase("pt-BR").includes(alvo)),
    );
  }, [doCanal, busca]);

  const resumo = useMemo(() => resumoVendas(doCanal), [doCanal]);
  const estoqueBaixo = useMemo(
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
  const estoqueLigado = (estoqueQuery.data ?? []).some((p) => p.controlaEstoque);
  const canaisUsados = useMemo(() => new Set(vendas.map((v) => v.canal)), [vendas]);

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: chaveVendas(userId) });
    void qc.invalidateQueries({ queryKey: chaveEstoque(userId) });
    // O lançamento da venda entra no Financeiro e no Painel.
    void qc.invalidateQueries({ queryKey: ["financeiro", userId] });
    void qc.invalidateQueries({ queryKey: ["painel-dados", userId] });
    // Venda cancelada reabre o orçamento que virou ela (gatilho no banco).
    void qc.invalidateQueries({ queryKey: chaveOrcamentos(userId) });
  };

  const acao = (
    <div className="flex flex-wrap gap-2">
      {aba === "orcamentos" ? (
        <button type="button" onClick={() => setNovoOrcamento(true)} className={BTN_ACAO}>
          + Novo orçamento
        </button>
      ) : (
        <button type="button" onClick={() => setRegistrarAberto(true)} className={BTN_ACAO}>
          + Registrar venda
        </button>
      )}
      {/* Pedidos com dia de entrega (GRW-93) moram no quadro de Pedidos. */}
      {aba !== "orcamentos" && (
        <Link to="/pedidos" className={`${BTN_ACAO_CONTORNO} no-underline`}>
          Ver como quadro
        </Link>
      )}
      <button type="button" onClick={() => setTaxasAbertas(true)} className={BTN_ACAO_CONTORNO}>
        Taxas de recebimento
      </button>
    </div>
  );

  const cabecalho = {
    largura: "larga" as const,
    eyebrow: "Vendas",
    titulo: "Suas vendas.",
    subtitulo: "O que saiu, por onde e quanto a marca lucrou.",
  };

  if (vendasQuery.isError) {
    return (
      <PaginaLogada {...cabecalho}>
        <div role="alert">
          <BlockError
            message="A Pólia One não conseguiu ler as suas vendas agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => void vendasQuery.refetch()}
          />
        </div>
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada {...cabecalho} acao={acao}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Visão" className="flex gap-2">
          {(
            [
              { id: "pedidos", label: "Todas as vendas" },
              { id: "ranking", label: "Mais vendidos" },
              { id: "clientes", label: "Quem compra" },
              {
                id: "orcamentos",
                label:
                  aprovados > 0
                    ? `Orçamentos · ${aprovados} ${aprovados === 1 ? "aprovado" : "aprovados"}`
                    : "Orçamentos",
              },
            ] as { id: Aba; label: string }[]
          ).map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={aba === a.id}
              onClick={() => setAba(a.id)}
              className={`${BTN_MIUDO} ${aba === a.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Período"
          className={`flex flex-wrap gap-2 sm:ml-auto ${aba === "orcamentos" ? "hidden" : ""}`}
        >
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={periodo === p.id}
              onClick={() => setPeriodo(p.id)}
              className={`${BTN_MIUDO} ${periodo === p.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {aba === "orcamentos" ? (
        userId && (
          <div className="mt-6">
            <ListaOrcamentos
              userId={userId}
              novoAberto={novoOrcamento}
              onNovoAbertoChange={setNovoOrcamento}
              onVendaRegistrada={recarregar}
            />
          </div>
        )
      ) : (
        <>
          {/* Resumo do período (respeita o filtro de canal) */}
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero
              rotulo="Vendas"
              valor={vendasQuery.isLoading ? "…" : String(resumo.quantidade)}
            />
            <Numero
              rotulo="Entrou"
              valor={vendasQuery.isLoading ? "…" : fmt(resumo.entrou)}
              nota={resumo.aReceber > 0 ? `${fmt(resumo.aReceber)} a receber` : undefined}
            />
            <Numero
              rotulo="A marca lucrou"
              valor={vendasQuery.isLoading ? "…" : fmt(resumo.lucrou)}
              nota={
                resumo.semCusto > 0
                  ? `${resumo.semCusto} ${resumo.semCusto === 1 ? "venda sem custo cadastrado ficou" : "vendas sem custo cadastrado ficaram"} fora da conta`
                  : undefined
              }
            />
            <div className="rounded-xl bg-[var(--surface)] p-4">
              <dt className="text-[13px] text-[var(--muted)]">Estoque baixo</dt>
              <dd className="font-cabinet mt-1 text-[24px] text-[var(--ink)]">
                {estoqueQuery.isLoading
                  ? "…"
                  : estoqueQuery.isError
                    ? "não carregou"
                    : !estoqueLigado
                      ? "desligado"
                      : `${estoqueBaixo} ${estoqueBaixo === 1 ? "item" : "itens"}`}
              </dd>
              {!estoqueQuery.isLoading &&
                !estoqueQuery.isError &&
                (!estoqueLigado || estoqueBaixo > 0) && (
                  <Link
                    to="/produtos"
                    search={{ aba: "estoque" }}
                    className="mt-1 inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] no-underline hover:underline"
                  >
                    {estoqueLigado ? "Ver estoque" : "Ligar estoque"}
                  </Link>
                )}
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="vendas-canal">
              Canal
            </label>
            <select
              id="vendas-canal"
              value={canal}
              onChange={(e) => setCanal(e.target.value as CanalVenda | "todos")}
              className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            >
              <option value="todos">Todos os canais</option>
              {CANAIS_VENDA.filter((c) => canaisUsados.has(c) || c === canal).map((c) => (
                <option key={c} value={c}>
                  {CANAL_LABEL[c]}
                </option>
              ))}
            </select>
            {aba === "pedidos" && (
              <>
                <label className="sr-only" htmlFor="vendas-busca">
                  Buscar cliente ou produto
                </label>
                <input
                  id="vendas-busca"
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar cliente ou produto"
                  className="min-h-11 flex-1 rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
                />
              </>
            )}
          </div>

          <div className="mt-4">
            {vendasQuery.isLoading ? (
              <p className="text-[14px] text-[var(--muted)]">Carregando suas vendas…</p>
            ) : aba === "ranking" ? (
              <>
                <MaisVendidos vendas={doCanal} />
                {userId && <ProdutosParados userId={userId} />}
              </>
            ) : aba === "clientes" ? (
              userId && (
                <QuemCompra
                  userId={userId}
                  vendas={doCanal}
                  inicioDoPeriodo={de}
                  canalFiltrado={canal !== "todos"}
                />
              )
            ) : vendas.length === 0 ? (
              <Vazio
                icone={ShoppingBag}
                titulo="Nenhuma venda nesse período."
                texto="Registre a próxima: o estoque baixa sozinho e o dinheiro entra no Financeiro."
                acao={
                  <button
                    type="button"
                    onClick={() => setRegistrarAberto(true)}
                    className={BTN_ACAO}
                  >
                    + Registrar venda
                  </button>
                }
              />
            ) : filtradas.length === 0 ? (
              <p className="rounded-xl border border-[var(--line)] bg-white p-6 text-[14px] text-[var(--ink-soft)]">
                Nenhuma venda com esse filtro.
              </p>
            ) : (
              <ListaVendas vendas={filtradas} onAbrir={setVendaAberta} />
            )}
          </div>
        </>
      )}

      {registrarAberto && userId && (
        <ModalRegistrarVenda
          userId={userId}
          onClose={() => setRegistrarAberto(false)}
          onSaved={() => {
            setRegistrarAberto(false);
            recarregar();
          }}
        />
      )}
      {taxasAbertas && userId && (
        <ModalTaxas
          userId={userId}
          onClose={() => setTaxasAbertas(false)}
          onSaved={() => {
            setTaxasAbertas(false);
            void qc.invalidateQueries({ queryKey: chaveTaxas(userId) });
            toastSucesso(
              "Taxas salvas. Na venda, escolha a forma de recebimento e a Pólia One preenche a taxa.",
            );
          }}
        />
      )}
      {vendaAberta && (
        <ModalVenda
          venda={vendaAberta}
          onClose={() => setVendaAberta(null)}
          onMudou={() => {
            setVendaAberta(null);
            recarregar();
          }}
        />
      )}
    </PaginaLogada>
  );
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-4">
      <dt className="text-[13px] text-[var(--muted)]">{rotulo}</dt>
      <dd className="font-cabinet mt-1 text-[24px] text-[var(--ink)]">{valor}</dd>
      {nota && <dd className="mt-1 text-[12px] text-[var(--muted)]">{nota}</dd>}
    </div>
  );
}

function resumoItens(v: VendaLinha) {
  return v.itens
    .map((i) => `${i.quantidade}x ${i.produtoNome}${i.variacao ? ` (${i.variacao})` : ""}`)
    .join(", ");
}

function ListaVendas({
  vendas,
  onAbrir,
}: {
  vendas: VendaLinha[];
  onAbrir: (v: VendaLinha) => void;
}) {
  return (
    <ul className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      {vendas.map((v) => {
        const lucro = lucroDaVenda(v);
        const cancelada = v.status === "cancelada";
        return (
          <li key={v.id} className="border-t border-[var(--line)] first:border-t-0">
            <button
              type="button"
              onClick={() => onAbrir(v)}
              className="grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ink)] sm:grid-cols-[64px_minmax(0,1fr)_120px_100px_110px]"
            >
              <span className="text-[13px] text-[var(--muted)]">{fmtData(v.data).slice(0, 5)}</span>
              <span className={`min-w-0 ${cancelada ? "text-[var(--muted)] line-through" : ""}`}>
                <span className="block truncate text-[14px] text-[var(--ink)]">
                  {resumoItens(v)}
                </span>
                <span className="block truncate text-[12px] text-[var(--muted)]">
                  {v.clienteNome ?? "sem cliente"}
                  <span className="sm:hidden"> · {CANAL_LABEL[v.canal]}</span>
                </span>
              </span>
              <span className="hidden text-[13px] text-[var(--ink-soft)] sm:block">
                {CANAL_LABEL[v.canal]}
              </span>
              <span className="text-right text-[14px] tabular-nums text-[var(--ink)]">
                {fmt(v.total)}
              </span>
              <span className="col-span-3 text-right text-[13px] tabular-nums sm:col-span-1">
                {cancelada ? (
                  <span className="text-[var(--muted)]">cancelada</span>
                ) : v.status === "a_receber" ? (
                  <span className="text-[var(--muted)]">a receber</span>
                ) : lucro == null ? (
                  <span className="text-[var(--muted)]">sem custo</span>
                ) : (
                  <span className={lucro < 0 ? "text-[var(--danger)]" : "text-[var(--ink-soft)]"}>
                    lucrou {fmt(lucro)}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
