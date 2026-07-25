import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

type RegistrarTipo = "entrada" | "saida";

interface FinanceiroSearch {
  registrar?: RegistrarTipo;
  valor?: number;
  desc?: string;
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · Pólia" },
      {
        name: "description",
        content: "Seu fluxo de caixa: entradas, saídas, lucro e meta do mês.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): FinanceiroSearch => {
    const registrar =
      search.registrar === "entrada" || search.registrar === "saida"
        ? (search.registrar as RegistrarTipo)
        : undefined;
    const valorNum = Number(search.valor);
    const valor = Number.isFinite(valorNum) && valorNum > 0 ? valorNum : undefined;
    const desc = typeof search.desc === "string" && search.desc ? search.desc : undefined;
    return { registrar, valor, desc };
  },
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    if (profile && profile.onboarding_completed === false) {
      throw redirect({ to: "/painel" });
    }
  },
  component: FinanceiroPage,
});

interface Lancamento {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  descricao: string | null;
  categoria: string | null;
  created_at: string;
}

interface CampoRow {
  campo: string;
  valor: string | null;
}

interface MetaMesRow {
  id: string;
  valor_alvo: number | null;
  valor_atual: number;
}

// Semente padrão pra usuárias novas; some assim que o histórico real tiver categorias.
const CATEGORIAS_ENTRADA = ["Venda de produto", "Prestação de serviço", "Outros"];
const CATEGORIAS_SAIDA = ["Insumos / estoque", "Marketing", "Ferramentas e assinaturas", "Outros"];
const NOVA_CATEGORIA = "+ nova categoria";

function fmt(v: number) {
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function fmtData(iso: string) {
  // iso = "YYYY-MM-DD"
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function mesAnoDe(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return { ano: y, mes: m };
}

// Extrai o primeiro número de um texto livre em pt-BR ("R$ 2.500" → 2500).
function numeroDe(texto: string): number {
  const m = texto.match(/[\d.,]+/);
  if (!m) return 0;
  let s = m[0];
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  } else if (temPonto && /\.\d{3}(\D|$)/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

type PeriodoId = "mes" | "passado" | "custom";
type FiltroTipo = "todos" | "entrada" | "saida";

function FinanceiroPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const hoje = useMemo(() => new Date(), []);
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();
  const hojeISO = hoje.toISOString().slice(0, 10);

  // ── Modal ──
  const [modalAberto, setModalAberto] = useState(false);
  const [modalTipo, setModalTipo] = useState<RegistrarTipo>("entrada");
  const [prefill, setPrefill] = useState<{
    valor?: number;
    desc?: string;
    categoria?: string;
  } | null>(null);
  const [lancamentoEdit, setLancamentoEdit] = useState<Lancamento | null>(null);
  const [modalVendaAberto, setModalVendaAberto] = useState(false);

  // ── Filtros do histórico ──
  const [periodo, setPeriodo] = useState<PeriodoId>("mes");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");

  const dadosQuery = useQuery({
    queryKey: ["financeiro", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [lancRes, camposRes, metaRes] = await Promise.all([
        supabase
          .from("lancamentos")
          .select("id, tipo, valor, data, descricao, categoria, created_at")
          .eq("user_id", userId!)
          .order("data", { ascending: false }),
        supabase
          .from("planejamento_campos" as never)
          .select("campo, valor")
          .eq("user_id", userId!)
          .in("campo", ["financeiro.meta_minima", "financeiro.meta_celebracao"]),
        supabase
          .from("metas")
          .select("id, valor_alvo, valor_atual")
          .eq("user_id", userId!)
          .eq("titulo", "Meta do mês")
          .maybeSingle(),
      ]);
      return {
        lancamentos: (lancRes.data ?? []) as Lancamento[],
        campos: ((camposRes as unknown as { data: CampoRow[] | null }).data ?? []) as CampoRow[],
        metaMes: (metaRes.data ?? null) as MetaMesRow | null,
      };
    },
  });

  const lancamentos = useMemo(
    () => dadosQuery.data?.lancamentos ?? [],
    [dadosQuery.data?.lancamentos],
  );

  const campoValor = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of dadosQuery.data?.campos ?? []) if (c.valor && c.valor.trim()) m.set(c.campo, c.valor);
    return m;
  }, [dadosQuery.data?.campos]);

  const metaMes = dadosQuery.data?.metaMes ?? null;
  const metaAlvo = metaMes?.valor_alvo ?? 0;

  const initial = (user?.user_metadata?.full_name ?? user?.email ?? "P").charAt(0).toUpperCase();

  // ── Computado: mês corrente ──
  const { entradas, saidas } = useMemo(() => {
    let e = 0;
    let s = 0;
    for (const l of lancamentos) {
      const { ano, mes } = mesAnoDe(l.data);
      if (ano !== anoAtual || mes !== mesAtual) continue;
      if (l.tipo === "entrada") e += Number(l.valor);
      else if (l.tipo === "saida") s += Number(l.valor);
    }
    return { entradas: e, saidas: s };
  }, [lancamentos, anoAtual, mesAtual]);

  const lucro = entradas - saidas;

  const lancamentosMes = useMemo(() => {
    return lancamentos.filter((l) => {
      const { ano, mes } = mesAnoDe(l.data);
      return ano === anoAtual && mes === mesAtual;
    });
  }, [lancamentos, anoAtual, mesAtual]);

  const numEntradasMes = lancamentosMes.filter((l) => l.tipo === "entrada").length;

  const maiorSaidaCategoria = useMemo(() => {
    let maior: Lancamento | null = null;
    for (const l of lancamentosMes) {
      if (l.tipo !== "saida") continue;
      if (!maior || Number(l.valor) > Number(maior.valor)) maior = l;
    }
    return maior?.categoria || (maior ? "Outros" : null);
  }, [lancamentosMes]);

  const margemPct = entradas > 0 ? Math.round((lucro / entradas) * 100) : 0;

  // ── Marcas da régua (leitura, vêm do Módulo 4 do Planejamento) ──
  // "mês bom" (financeiro.meta_boa) não entra aqui: é a própria Meta do mês,
  // já o denominador da barra (metaAlvo), não uma marca adicional.
  const marcas = useMemo(() => {
    const lista: { chave: string; texto: string; num: number }[] = [];
    for (const [campo, label] of [
      ["financeiro.meta_minima", "mínimo"],
      ["financeiro.meta_celebracao", "comemorar"],
    ] as const) {
      const texto = campoValor.get(campo);
      if (texto) lista.push({ chave: campo, texto: `${label} · ${texto}`, num: numeroDe(texto) });
    }
    return lista;
  }, [campoValor]);

  // ── Search-param trigger (abrir modal vindo de /clientes) ──
  useEffect(() => {
    if (!search.registrar) return;
    setLancamentoEdit(null);
    setModalTipo(search.registrar);
    setPrefill({
      valor: search.valor,
      desc: search.desc,
      categoria: search.registrar === "entrada" ? "Venda de produto" : undefined,
    });
    setModalAberto(true);
    navigate({ to: "/financeiro", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Histórico filtrado ──
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
      const { ano, mes } = mesAnoDe(l.data);
      if (periodo === "mes") {
        if (ano !== anoAtual || mes !== mesAtual) return false;
      } else if (periodo === "passado") {
        const mp = mesAtual === 1 ? 12 : mesAtual - 1;
        const ap = mesAtual === 1 ? anoAtual - 1 : anoAtual;
        if (ano !== ap || mes !== mp) return false;
      } else if (periodo === "custom") {
        if (customDe && l.data < customDe) return false;
        if (customAte && l.data > customAte) return false;
      }
      return true;
    });
  }, [lancamentos, filtroTipo, periodo, customDe, customAte, anoAtual, mesAtual]);

  const abrirModal = (tipo: RegistrarTipo) => {
    setLancamentoEdit(null);
    setModalTipo(tipo);
    setPrefill(null);
    setModalAberto(true);
  };

  const abrirEditar = (l: Lancamento) => {
    setLancamentoEdit(l);
    setModalTipo(l.tipo as RegistrarTipo);
    setPrefill(null);
    setModalAberto(true);
  };

  const excluirLancamento = async (l: Lancamento) => {
    if (!window.confirm("Excluir este lançamento? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("lancamentos").delete().eq("id", l.id);
    if (error) {
      toastErro("Não consegui excluir o lançamento. Tenta de novo.");
      return;
    }
    track("lancamento_excluido", { tipo: l.tipo });
    qc.invalidateQueries({ queryKey: ["financeiro", userId] });
  };

  // Denominador único: valor_alvo da meta "Meta do mês" (mesma fonte que /metas gerencia).
  const metaPct = metaAlvo > 0 ? Math.min((entradas / metaAlvo) * 100, 100) : 0;

  const reduce = usePrefersReducedMotion();
  const [barOn, setBarOn] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setBarOn(true)));
    return () => cancelAnimationFrame(id);
  }, [reduce]);

  // ── Loading ──
  if (dadosQuery.isLoading) {
    return (
      <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <PainelNav initial={initial} streak={0} navActive="/financeiro" />
      </div>
    );
  }

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav initial={initial} streak={0} navActive="/financeiro" />

      <div className="mx-auto max-w-[1120px] px-6 py-12 md:px-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
          Este mês ·{" "}
          {hoje.toLocaleDateString("pt-BR", { month: "long" })}
        </p>

        {/* ───────── 1. Cards de resumo ───────── */}
        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="group rounded-xl border border-[var(--line)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Entradas
            </p>
            <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
              {fmt(entradas)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">{numEntradasMes} registros</p>
          </div>

          <div className="group rounded-xl border border-[var(--line)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Saídas
            </p>
            <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
              {fmt(saidas)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {maiorSaidaCategoria ? `maior saída: ${maiorSaidaCategoria}` : "nenhuma saída ainda"}
            </p>
          </div>

          <div className="group rounded-xl border border-[var(--line)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Lucro líquido
            </p>
            <p
              className={`font-cabinet mt-1 text-[32px] leading-none ${
                lucro < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"
              }`}
            >
              {fmt(lucro)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">{margemPct}% do que entrou virou lucro</p>
          </div>
        </section>

        {/* ───────── 2. Meta do mês (régua) ───────── */}
        <section className="mt-5 rounded-xl bg-[var(--surface)] p-6 md:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
            Onde o mês está agora
          </p>

          {metaAlvo <= 0 ? (
            <p className="mt-6 text-[14px] text-[var(--ink-soft)]">
              Ainda sem Meta do mês ativa.{" "}
              <a href="/metas" className="text-[var(--secondary-text)] hover:underline">
                Criar em Metas →
              </a>
            </p>
          ) : (
            <div className="relative mt-7 mb-14 h-3.5 rounded-lg border border-[var(--line)] bg-white">
              <div
                className="absolute inset-y-0 left-0 rounded-lg rounded-r-none bg-[var(--secondary)] transition-[width] duration-[800ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${barOn ? metaPct : 0}%` }}
              />
              {marcas.map((m) => {
                const left = Math.min(99, (m.num / metaAlvo) * 100);
                return (
                  <div
                    key={m.chave}
                    className="group/mark absolute -top-1.5 -bottom-1.5 w-[2px] bg-[var(--ink)]"
                    style={{ left: `${left}%` }}
                  >
                    <span
                      className="absolute -top-[34px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)] transition-colors duration-150 group-hover/mark:bg-[var(--secondary-light)]"
                      style={left > 90 ? { transform: "translateX(-90%)" } : undefined}
                    >
                      {m.texto}
                    </span>
                  </div>
                );
              })}
              <span
                className="absolute top-[22px] -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--highlight)] px-2 py-0.5 text-[12px] font-semibold text-[var(--highlight-ink)]"
                style={{ left: `${Math.min(96, metaPct)}%` }}
              >
                {fmt(Math.round(entradas))} agora
              </span>
            </div>
          )}

          <p className="mt-0 text-[13px] text-[var(--muted)]">
            Essa barra acompanha a "Meta do mês", uma das suas metas em Metas. As marcas de mínimo e
            comemorar vêm de Quanto vale, no seu Planejamento.
          </p>
        </section>

        {/* ───────── 3. Ações rápidas ───────── */}
        <section className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => abrirModal("entrada")}
            className="rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-ink)] hover:opacity-90"
          >
            + Registrar entrada
          </button>
          <button
            onClick={() => setModalVendaAberto(true)}
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-[var(--ink)] hover:border-[var(--secondary)]"
          >
            + Registrar venda de um produto
          </button>
          <button
            onClick={() => abrirModal("saida")}
            className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-[var(--ink)] hover:border-[var(--secondary)]"
          >
            + Registrar saída
          </button>
        </section>

        {/* ───────── 4. Histórico ───────── */}
        <section className="mt-10">
          <p className="text-[18px] text-[var(--ink)]">Histórico</p>

          {/* Filtros */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "mes", label: "Este mês" },
                  { id: "passado", label: "Mês passado" },
                  { id: "custom", label: "Personalizado" },
                ] as { id: PeriodoId; label: string }[]
              ).map((p) => {
                const ativo = periodo === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPeriodo(p.id)}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                      ativo
                        ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                        : "border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "todos", label: "Todos" },
                  { id: "entrada", label: "Entradas" },
                  { id: "saida", label: "Saídas" },
                ] as { id: FiltroTipo; label: string }[]
              ).map((t) => {
                const ativo = filtroTipo === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setFiltroTipo(t.id)}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                      ativo
                        ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                        : "border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {periodo === "custom" && (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                  De
                  <input
                    type="date"
                    value={customDe}
                    onChange={(e) => setCustomDe(e.target.value)}
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                  Até
                  <input
                    type="date"
                    value={customAte}
                    onChange={(e) => setCustomAte(e.target.value)}
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:outline-none"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Lista */}
          <div className="mt-6">
            {lancamentos.length === 0 ? (
              <p className="py-12 text-center text-[14px] text-[var(--muted)]">
                Nenhum lançamento ainda. Registre sua primeira entrada ou saída acima.
              </p>
            ) : lancamentosFiltrados.length === 0 ? (
              <p className="py-12 text-center text-[14px] text-[var(--muted)]">
                Nenhum lançamento nesse período.
              </p>
            ) : (
              lancamentosFiltrados.map((l) => (
                <LinhaLancamento
                  key={l.id}
                  l={l}
                  onEditar={() => abrirEditar(l)}
                  onExcluir={() => excluirLancamento(l)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      {/* ───────── 5. Modal ───────── */}
      {modalAberto && userId && (
        <ModalLancamento
          userId={userId}
          tipoInicial={modalTipo}
          dataPadrao={hojeISO}
          prefill={prefill}
          lancamentoEdit={lancamentoEdit}
          historico={lancamentos}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["financeiro", userId] });
            setModalAberto(false);
          }}
        />
      )}

      {/* ───────── 6. Modal: registrar venda de um produto ───────── */}
      {modalVendaAberto && userId && (
        <ModalRegistrarVendaProduto
          userId={userId}
          dataPadrao={hojeISO}
          onClose={() => setModalVendaAberto(false)}
          onSaved={(msg) => {
            qc.invalidateQueries({ queryKey: ["financeiro", userId] });
            setModalVendaAberto(false);
            toastSucesso(msg);
          }}
        />
      )}
    </div>
  );
}

/* ============== Linha do histórico + menu de opções ============== */
function LinhaLancamento({
  l,
  onEditar,
  onExcluir,
}: {
  l: Lancamento;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const entrada = l.tipo === "entrada";

  return (
    <div className="group relative flex items-center justify-between gap-4 rounded-lg border-b border-[var(--line)] px-3 py-4 transition-colors duration-150 hover:bg-white">
      <div className="min-w-0">
        <p className="text-[15px] text-[var(--ink-soft)]">
          {l.descricao || (entrada ? "Entrada" : "Saída")}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--muted)]">
          <span>{fmtData(l.data)}</span>
          {l.categoria && (
            <span className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11.5px] text-[var(--ink-soft)]">
              {l.categoria}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <p
          className={`font-cabinet text-[19px] tabular-nums ${
            entrada ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
          }`}
        >
          {entrada ? "+ " : "− "}
          {fmt(Number(l.valor))}
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Opções do lançamento"
            title="Opções do lançamento"
            className={`rounded-md p-1 text-[var(--muted)] opacity-0 transition-opacity duration-150 hover:bg-[var(--surface)] hover:text-[var(--ink)] focus-visible:opacity-100 group-hover:opacity-100 ${
              menuAberto ? "opacity-100" : ""
            }`}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
          {menuAberto && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuAberto(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-[var(--line)] bg-white py-1 shadow-sm">
                <button
                  onClick={() => {
                    setMenuAberto(false);
                    onEditar();
                  }}
                  className="block w-full px-3 py-2 text-left text-[14px] text-[var(--ink)] hover:bg-[var(--surface)]"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    setMenuAberto(false);
                    onExcluir();
                  }}
                  className="block w-full px-3 py-2 text-left text-[14px] text-[var(--danger)] hover:bg-[var(--surface)]"
                >
                  Excluir
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== Modal: novo / editar lançamento ============== */
function ModalLancamento({
  userId,
  tipoInicial,
  dataPadrao,
  prefill,
  lancamentoEdit,
  historico,
  onClose,
  onSaved,
}: {
  userId: string;
  tipoInicial: RegistrarTipo;
  dataPadrao: string;
  prefill: { valor?: number; desc?: string; categoria?: string } | null;
  lancamentoEdit: Lancamento | null;
  historico: Lancamento[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!lancamentoEdit;
  const [tipo, setTipo] = useState<RegistrarTipo>(
    (lancamentoEdit?.tipo as RegistrarTipo) ?? tipoInicial,
  );
  // Campo de valor: dígitos acumulam da direita pra esquerda, em centavos.
  const [cents, setCents] = useState(() => {
    const v = lancamentoEdit?.valor ?? prefill?.valor;
    return v ? Math.round(v * 100) : 0;
  });
  const [data, setData] = useState(lancamentoEdit?.data ?? dataPadrao);
  const [descricao, setDescricao] = useState(lancamentoEdit?.descricao ?? prefill?.desc ?? "");
  const [categoria, setCategoria] = useState(lancamentoEdit?.categoria ?? prefill?.categoria ?? "");
  const [novaCategoriaAberta, setNovaCategoriaAberta] = useState(false);
  const [novaCategoriaTexto, setNovaCategoriaTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorNum = cents / 100;

  // Categorias derivadas do histórico real da usuária, unidas com semente padrão pra quem é nova.
  const categorias = useMemo(() => {
    const semente = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;
    const doHistorico = [
      ...new Set(
        historico
          .filter((l) => l.tipo === tipo && l.categoria && l.categoria.trim())
          .map((l) => l.categoria!.trim()),
      ),
    ];
    const unidas = [...doHistorico];
    for (const s of semente) if (!unidas.includes(s)) unidas.push(s);
    return unidas;
  }, [historico, tipo]);

  const trocarTipo = (t: RegistrarTipo) => {
    setTipo(t);
    setCategoria(""); // categorias dependem do tipo; limpa ao trocar
    setNovaCategoriaAberta(false);
    setNovaCategoriaTexto("");
  };

  const escolherCategoria = (c: string) => {
    if (c === NOVA_CATEGORIA) {
      setNovaCategoriaAberta(true);
      return;
    }
    setCategoria(categoria === c ? "" : c);
  };

  const moedaFmt = (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const onValorKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setCents((c) => c * 10 + Number(e.key));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setCents((c) => Math.floor(c / 10));
    } else if (!["Tab", "Escape"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const categoriaFinal = novaCategoriaAberta ? novaCategoriaTexto.trim() : categoria;

  // Descrição e categoria são opcionais: dá pra registrar só o valor em 2 toques.
  const faltaMsg = !cents ? "Falta o valor" : "";

  const salvar = async () => {
    if (faltaMsg) return;
    setSalvando(true);
    setErro(null);
    const payload = {
      tipo,
      valor: valorNum,
      data,
      descricao: descricao.trim() || null,
      categoria: categoriaFinal || null,
    };
    const { error } =
      edit && lancamentoEdit
        ? await supabase.from("lancamentos").update(payload).eq("id", lancamentoEdit.id)
        : await supabase.from("lancamentos").insert({ user_id: userId, ...payload });
    setSalvando(false);
    if (error) {
      setErro(error.message || "Erro ao salvar.");
      return;
    }
    track(edit ? "lancamento_editado" : "lancamento_criado", { tipo });
    onSaved();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-[24px] text-[var(--ink)]">
          {edit ? "Editar lançamento" : "Novo lançamento"}
        </h2>

        {/* Tipo */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Tipo</label>
          <div className="flex gap-2">
            {(
              [
                { id: "entrada", label: "Entrada" },
                { id: "saida", label: "Saída" },
              ] as { id: RegistrarTipo; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => trocarTipo(t.id)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[14px] ${
                  tipo === t.id
                    ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                    : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Valor */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Valor (R$)</label>
          <input
            type="text"
            inputMode="numeric"
            value={cents ? moedaFmt : ""}
            onKeyDown={onValorKeyDown}
            onChange={() => {}}
            placeholder="R$ 0,00"
            autoFocus
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-right text-[22px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
          />
        </div>

        {/* Data */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:outline-none"
          />
        </div>

        {/* Descrição */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Descrição</label>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="ex: pagamento da Ana"
          />
        </div>

        {/* Categoria */}
        <div className="mb-6">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => escolherCategoria(c)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-150 ${
                  categoria === c
                    ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-ink)]"
                    : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => escolherCategoria(NOVA_CATEGORIA)}
              className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-150 ${
                novaCategoriaAberta
                  ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
              }`}
            >
              {NOVA_CATEGORIA}
            </button>
          </div>
          {novaCategoriaAberta && (
            <input
              autoFocus
              value={novaCategoriaTexto}
              onChange={(e) => setNovaCategoriaTexto(e.target.value)}
              placeholder="Nome da categoria"
              maxLength={40}
              className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            />
          )}
        </div>

        {erro && <p className="mb-3 text-[13px] text-[var(--danger)]">{erro}</p>}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-[var(--muted)]">{faltaMsg}</span>
          <span className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando || !!faltaMsg}
              className="rounded-xl bg-[var(--secondary)] px-5 py-2 text-[14px] font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : edit ? "Salvar alterações" : "Salvar lançamento"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============== Modal: registrar venda de um produto ============== */
interface ProdutoVenda {
  id: string;
  nome: string;
  preco_venda: number;
  preco_custo: number | null;
}

function ModalRegistrarVendaProduto({
  userId,
  dataPadrao,
  onClose,
  onSaved,
}: {
  userId: string;
  dataPadrao: string;
  onClose: () => void;
  onSaved: (mensagem: string) => void;
}) {
  const [produtoId, setProdutoId] = useState("");
  const [data, setData] = useState(dataPadrao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const produtosQuery = useQuery({
    queryKey: ["produtos-venda-rapida", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda, preco_custo")
        .eq("user_id", userId)
        .eq("arquivado", false)
        .order("nome");
      return (data ?? []) as ProdutoVenda[];
    },
  });
  const produtos = produtosQuery.data ?? [];
  const produto = produtos.find((p) => p.id === produtoId) ?? null;
  const sobrou = produto ? Number(produto.preco_venda) - Number(produto.preco_custo ?? 0) : null;

  const salvar = async () => {
    if (!produto) return;
    setSalvando(true);
    setErro(null);
    const { error } = await supabase.from("lancamentos").insert({
      user_id: userId,
      tipo: "entrada",
      valor: produto.preco_venda,
      data,
      descricao: produto.nome,
      categoria: "Venda de produto",
    });
    setSalvando(false);
    if (error) {
      setErro(error.message || "Erro ao salvar.");
      return;
    }
    track("venda_produto_registrada", { produto_id: produto.id });
    onSaved(
      sobrou !== null
        ? `Venda de "${produto.nome}" registrada. Dessa venda sobraram ${fmt(Math.round(sobrou))}.`
        : `Venda de "${produto.nome}" registrada.`,
    );
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-[24px] text-[var(--ink)]">Registrar venda de um produto</h2>
        <p className="mb-5 text-[13px] text-[var(--ink-soft)]">
          Cria a entrada no caixa com o preço do catálogo.
        </p>

        {produtosQuery.isLoading ? (
          <p className="py-6 text-center text-[14px] text-[var(--muted)]">Carregando produtos…</p>
        ) : produtos.length === 0 ? (
          <p className="py-6 text-[14px] text-[var(--ink-soft)]">
            Ainda não tem produto no catálogo.{" "}
            <Link to="/produtos" className="text-[var(--secondary-text)] hover:underline">
              Adicionar em Produtos →
            </Link>
          </p>
        ) : (
          <>
            <div className="mb-4">
              <label className="mb-1 block text-[12px] text-[var(--muted)]">Produto</label>
              <select
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:outline-none"
              >
                <option value="">Escolha um produto</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {fmt(Number(p.preco_venda))}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-[12px] text-[var(--muted)]">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:outline-none"
              />
            </div>

            {produto && (
              <div className="mb-4 rounded-lg bg-[var(--secondary-light)] px-3 py-2.5 text-[13px] text-[var(--secondary-text)]">
                {sobrou !== null ? (
                  <>Dessa venda sobram {fmt(Math.round(sobrou))}, descontado o custo direto.</>
                ) : (
                  <>Cadastre o custo desse produto pra ver quanto sobra.</>
                )}
              </div>
            )}
          </>
        )}

        {erro && <p className="mb-3 text-[13px] text-[var(--danger)]">{erro}</p>}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !produto}
            className="rounded-xl bg-[var(--secondary)] px-5 py-2 text-[14px] font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? "Registrando..." : "Registrar venda"}
          </button>
        </div>
      </div>
    </div>
  );
}
