import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Lock, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { sobraDoProduto, type CalculadoraBreakdown } from "@/lib/precificacao.functions";
import { fmt as fmtCentavos } from "@/components/produtos/tipos";
import { hojeISO, mesAnoAtual, mesAnoDe, ehMesAtual } from "@/lib/data.functions";
import { temProjete } from "@/lib/planos";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { ResumoContadorModal } from "@/components/financeiro/ResumoContadorModal";
// O modal de lançamento saiu daqui em 03/09/2026 (COPY-04): o Painel do plano Grátis
// também registra entrada/saída por ele, sem abrir esta tela.
import {
  ModalLancamento,
  type Lancamento,
  type RegistrarTipo,
} from "@/components/financeiro/ModalLancamento";
import { LinkInterno } from "@/components/ui/LinkInterno";

interface FinanceiroSearch {
  registrar?: RegistrarTipo;
  valor?: number;
  desc?: string;
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro · Pólia One" },
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
  component: FinanceiroPage,
});

interface CampoRow {
  campo: string;
  valor: string | null;
}

interface MetaMesRow {
  id: string;
  valor_alvo: number | null;
  valor_atual: number;
}

// Valor redondo sem centavos ("R$ 3.000", cabe nos cards de 32px); com
// centavos, sempre duas casas: antes um mês com R$ 44,10 aparecia "R$ 44,1".
function fmt(v: number) {
  const casas = Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: 2 })}`;
}

function fmtData(iso: string) {
  // iso = "YYYY-MM-DD"
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
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

  // ── "Agora" só é lido no cliente pra não divergir da hidratação SSR (mesmo padrão de painel.tsx) ──
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  const { ano: anoAtual, mes: mesAtual } = useMemo(
    () => (clientReady ? mesAnoAtual() : { ano: 0, mes: 0 }),
    [clientReady],
  );
  const hojeISOStr = useMemo(() => (clientReady ? hojeISO() : ""), [clientReady]);

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
  const [lancamentoExcluir, setLancamentoExcluir] = useState<Lancamento | null>(null);
  const [excluindoLancamento, setExcluindoLancamento] = useState(false);

  // ── Filtros do histórico ──
  const [periodo, setPeriodo] = useState<PeriodoId>("mes");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");

  const dadosQuery = useQuery({
    queryKey: ["financeiro", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [lancamentosTodos, camposRes, metaRes] = await Promise.all([
        // Todos os lançamentos, lidos página por página (QA-24/QA-28): o
        // histórico, os filtros de período e o resumo pro contador precisam de
        // tudo, e o PostgREST corta em 1.000 linhas sem avisar. Se a leitura
        // falhar ou passar do teto, o erro sobe e a tela mostra o BlockError em
        // vez de somar só uma parte.
        lerTodasAsPaginas<Lancamento>((de, ate) =>
          supabase
            .from("lancamentos")
            .select("id, tipo, valor, data, descricao, categoria, created_at")
            .eq("user_id", userId!)
            .order("data", { ascending: false })
            .order("id", { ascending: true })
            .range(de, ate)
            .then((r) => ({ data: r.data as unknown as Lancamento[] | null, error: r.error })),
        ),
        supabase
          .from("planejamento_campos" as never)
          .select("campo, valor")
          .eq("user_id", userId!)
          .in("campo", ["financeiro.meta_minima", "financeiro.meta_celebracao"]),
        buscarMetaDoMes(supabase, userId!),
      ]);
      const falha = [camposRes, metaRes].find((r) => (r as { error: unknown }).error);
      if (falha) throw (falha as { error: unknown }).error;
      return {
        lancamentos: lancamentosTodos,
        campos: ((camposRes as unknown as { data: CampoRow[] | null }).data ?? []) as CampoRow[],
        metaMes: (metaRes.data ?? null) as MetaMesRow | null,
      };
    },
  });

  const lancamentos = useMemo(
    () => dadosQuery.data?.lancamentos ?? [],
    [dadosQuery.data?.lancamentos],
  );

  // Resumo pro contador (Pro): plano checado direto, não por tierDoPlano
  // (que funde controle/projete no mesmo tier de rota da Fase 1).
  const perfilResumoQuery = useQuery({
    queryKey: ["financeiro-perfil", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("plano, razao_social, cnpj")
        .eq("id", userId!)
        .maybeSingle();
      return data as { plano: string; razao_social: string | null; cnpj: string | null } | null;
    },
  });
  const ehProjete = temProjete(perfilResumoQuery.data?.plano);
  const [resumoContadorAberto, setResumoContadorAberto] = useState(false);

  const campoValor = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of dadosQuery.data?.campos ?? [])
      if (c.valor && c.valor.trim()) m.set(c.campo, c.valor);
    return m;
  }, [dadosQuery.data?.campos]);

  const metaMes = dadosQuery.data?.metaMes ?? null;
  const metaAlvo = metaMes?.valor_alvo ?? 0;

  const initial = (user?.user_metadata?.full_name ?? user?.email ?? "P").charAt(0).toUpperCase();

  // ── Computado: mês corrente ──
  const { entradas, saidas } = useMemo(() => {
    if (!clientReady) return { entradas: 0, saidas: 0 };
    let e = 0;
    let s = 0;
    for (const l of lancamentos) {
      if (!l.data || !ehMesAtual(l.data)) continue;
      if (l.tipo === "entrada") e += Number(l.valor);
      else if (l.tipo === "saida") s += Number(l.valor);
    }
    return { entradas: e, saidas: s };
  }, [lancamentos, clientReady]);

  const lucro = entradas - saidas;

  const lancamentosMes = useMemo(() => {
    if (!clientReady) return [];
    return lancamentos.filter((l) => l.data && ehMesAtual(l.data));
  }, [lancamentos, clientReady]);

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
    const lista: { chave: string; rotulo: string; detalhe: string; num: number }[] = [];
    for (const [campo, label] of [
      ["financeiro.meta_minima", "mínimo"],
      ["financeiro.meta_celebracao", "celebrar"],
    ] as const) {
      const texto = campoValor.get(campo);
      if (!texto) continue;
      const num = numeroDe(texto);
      // O rótulo mostra só o número. Antes vinha a resposta inteira do
      // Planejamento ("R$ 4.500 paga tudo, incluindo o meu mínimo."), e como o
      // rótulo é whitespace-nowrap, duas marcas próximas se sobrepunham em
      // 170px, deixando as duas ilegíveis. A frase completa vai pro title.
      lista.push({ chave: campo, rotulo: `${label} · ${fmt(num)}`, detalhe: texto, num });
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

  const excluirLancamento = (l: Lancamento) => {
    setLancamentoExcluir(l);
  };

  const confirmarExcluirLancamento = async () => {
    if (!lancamentoExcluir) return;
    setExcluindoLancamento(true);
    const { error } = await supabase.from("lancamentos").delete().eq("id", lancamentoExcluir.id);
    setExcluindoLancamento(false);
    if (error) {
      toastErro("A Pólia One não conseguiu excluir o lançamento. Tenta de novo.");
      return;
    }
    track("lancamento_excluido", { tipo: lancamentoExcluir.tipo });
    qc.invalidateQueries({ queryKey: ["financeiro", userId] });
    setLancamentoExcluir(null);
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
  if (dadosQuery.isError) {
    return (
      <PaginaLogada largura="larga" eyebrow="Este mês" titulo="O dinheiro do mês.">
        <div role="alert">
          <BlockError
            message="A Pólia One não conseguiu ler os lançamentos agora. Nada foi perdido, é só a leitura que falhou."
            onRetry={() => dadosQuery.refetch()}
          />
        </div>
      </PaginaLogada>
    );
  }
  if (!dadosQuery.isSuccess) {
    return (
      <PaginaLogada largura="larga" eyebrow="Este mês" titulo="O dinheiro do mês.">
        <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Carregando o mês">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
            />
          ))}
        </div>
      </PaginaLogada>
    );
  }

  return (
    <PaginaLogada
      dica="financeiro"
      largura="larga"
      eyebrow={
        clientReady && mesAtual > 0
          ? `Este mês · ${new Date(anoAtual, mesAtual - 1, 1).toLocaleDateString("pt-BR", { month: "long" })}`
          : "Este mês"
      }
      titulo="O dinheiro do mês."
      subtitulo="Tudo o que entrou e saiu, e o que sobrou no fim."
      acao={
        ehProjete ? (
          <button
            type="button"
            onClick={() => setResumoContadorAberto(true)}
            className={BTN_ACAO_CONTORNO}
          >
            <FileText size={14} aria-hidden="true" />
            Resumo pro contador
          </button>
        ) : (
          <Link
            to="/upgrade"
            search={{ rota: "/financeiro", tier: "projete" }}
            className={`${BTN_ACAO_CONTORNO} text-[var(--muted)]`}
          >
            <Lock size={14} aria-hidden="true" />
            Resumo pro contador
          </Link>
        )
      }
    >
      <div>
        {/* ───────── 1. Cards de resumo ───────── */}
        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Entradas
            </p>
            <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
              {fmt(entradas)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">{numEntradasMes} registros</p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Saídas
            </p>
            <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
              {fmt(saidas)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {maiorSaidaCategoria ? `maior saída: ${maiorSaidaCategoria}` : "nenhuma saída ainda"}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Sobrou no mês
            </p>
            <p
              className={`font-cabinet mt-1 text-[32px] leading-none ${
                lucro < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"
              }`}
            >
              {fmt(lucro)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">{margemPct}% de tudo que entrou</p>
          </div>
        </section>

        {/* ───────── 2. Meta do mês (régua) ───────── */}
        <section className="mt-6 rounded-xl bg-[var(--surface)] p-6 md:p-8">
          <p className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Onde o mês está agora
          </p>

          {metaAlvo <= 0 ? (
            <p className="mt-6 text-[14px] text-[var(--ink-soft)]">
              Ainda sem Meta do mês ativa.{" "}
              <LinkInterno href="/metas" className="text-[var(--secondary-text)] hover:underline">
                Criar em Metas →
              </LinkInterno>
            </p>
          ) : (
            <div
              className="relative mt-7 mb-14 h-3.5 rounded-lg border border-[var(--line)] bg-white"
              role="progressbar"
              aria-valuenow={Math.round(metaPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso da Meta do mês"
              aria-valuetext={`${fmt(Math.round(entradas))} de ${fmt(metaAlvo)}, ${Math.round(metaPct)}% da meta`}
            >
              {/* O corte fica só no preenchimento: no trilho, cortava os rótulos
                  das marcas e o selo de "entraram até aqui", que moram fora dele. */}
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
              {marcas.map((m) => {
                const left = Math.min(99, (m.num / metaAlvo) * 100);
                return (
                  <div
                    key={m.chave}
                    className="group/mark absolute -top-1.5 -bottom-1.5 w-[2px] bg-[var(--ink)]"
                    style={{ left: `${left}%` }}
                  >
                    <span
                      title={m.detalhe}
                      className={`absolute -top-[34px] left-1/2 whitespace-nowrap rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)] transition-colors duration-150 group-hover/mark:bg-[var(--secondary-light)] ${
                        left > 90 ? "-translate-x-[90%]" : "-translate-x-1/2"
                      }`}
                    >
                      {m.rotulo}
                    </span>
                  </div>
                );
              })}
              <span
                className={`absolute top-[22px] whitespace-nowrap rounded-md bg-[var(--highlight)] px-2 py-0.5 text-[12px] font-semibold text-[var(--highlight-ink)] ${
                  metaPct < 8 ? "" : metaPct > 92 ? "-translate-x-full" : "-translate-x-1/2"
                }`}
                style={{ left: `${Math.min(100, metaPct)}%` }}
              >
                {fmt(Math.round(entradas))} entraram até aqui
              </span>
            </div>
          )}

          <p className="mt-0 text-[13px] text-[var(--muted)]">
            Essa barra acompanha a "Meta do mês", uma das suas metas em Metas. As marcas de mínimo e
            celebrar vêm de Quanto vale, no seu Planejamento.
          </p>
        </section>

        {/* ───────── 3. Ações rápidas ───────── */}
        <section className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => abrirModal("entrada")} className={BTN_ACAO}>
            + Registrar entrada
          </button>
          <button
            type="button"
            onClick={() => setModalVendaAberto(true)}
            className={BTN_ACAO_CONTORNO}
          >
            + Registrar venda de um produto
          </button>
          <button type="button" onClick={() => abrirModal("saida")} className={BTN_ACAO_CONTORNO}>
            + Registrar saída
          </button>
        </section>

        {/* ───────── 4. Histórico ───────── */}
        <section className="mt-12">
          <h2 className="text-[20px] leading-tight text-[var(--ink)]">Histórico</h2>

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
                    type="button"
                    onClick={() => setPeriodo(p.id)}
                    aria-pressed={ativo}
                    className={`${BTN_MIUDO} ${ativo ? "!bg-[var(--secondary)]" : "bg-white"}`}
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
                    type="button"
                    onClick={() => setFiltroTipo(t.id)}
                    aria-pressed={ativo}
                    className={`${BTN_MIUDO} ${ativo ? "!bg-[var(--secondary)]" : "bg-white"}`}
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
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                  Até
                  <input
                    type="date"
                    value={customAte}
                    onChange={(e) => setCustomAte(e.target.value)}
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Lista */}
          <div className="mt-6">
            {lancamentos.length === 0 ? (
              <Vazio
                icone={Wallet}
                titulo="Nenhum lançamento ainda."
                texto="Cada entrada e saída registrada aqui vira o número de quanto sobra no fim do mês."
                acao={
                  <button type="button" onClick={() => abrirModal("entrada")} className={BTN_ACAO}>
                    Quero registrar a primeira
                  </button>
                }
              />
            ) : lancamentosFiltrados.length === 0 ? (
              <Vazio
                icone={Wallet}
                titulo="Nenhum lançamento nesse período."
                texto="Troca o filtro logo acima pra ver outro período, ou registra uma entrada agora."
                acao={
                  <button type="button" onClick={() => abrirModal("entrada")} className={BTN_ACAO}>
                    Quero registrar uma entrada
                  </button>
                }
              />
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
      {/* ModalLancamento migrou pro <Modal> (Radix Dialog) em 28/09/2026: a
          animação de abrir/fechar agora vive dentro dele (data-state do
          Radix), então não precisa mais de AnimatePresence aqui fora —
          mesmo padrão de ModalMeta em metas.tsx. */}
      {modalAberto && userId && (
        <ModalLancamento
          userId={userId}
          tipoInicial={modalTipo}
          dataPadrao={hojeISOStr}
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
          dataPadrao={hojeISOStr}
          onClose={() => setModalVendaAberto(false)}
          onSaved={(msg) => {
            qc.invalidateQueries({ queryKey: ["financeiro", userId] });
            setModalVendaAberto(false);
            toastSucesso(msg);
          }}
        />
      )}

      {/* ───────── 7. Modal: resumo pro contador (Pro) ───────── */}
      {resumoContadorAberto && ehProjete && (
        <ResumoContadorModal
          lancamentos={lancamentos}
          razaoSocial={perfilResumoQuery.data?.razao_social ?? null}
          cnpj={perfilResumoQuery.data?.cnpj ?? null}
          onClose={() => setResumoContadorAberto(false)}
          onEditarLancamento={(id) => {
            const l = lancamentos.find((x) => x.id === id);
            if (!l) return;
            setResumoContadorAberto(false);
            abrirEditar(l);
          }}
          onIrParaFinanceiro={() => setResumoContadorAberto(false)}
        />
      )}

      {/* ───────── 8. Confirmação: excluir lançamento ───────── */}
      <ConfirmarAcao
        open={!!lancamentoExcluir}
        onOpenChange={(open) => !open && setLancamentoExcluir(null)}
        titulo="Excluir lançamento"
        descricao="Essa ação não pode ser desfeita."
        textoConfirmar="Excluir"
        destrutivo
        carregando={excluindoLancamento}
        onConfirmar={() => void confirmarExcluirLancamento()}
      />
    </PaginaLogada>
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
  const entrada = l.tipo === "entrada";

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border-b border-[var(--line)] px-3 py-4 transition-colors duration-150 hover:bg-white">
      <div className="min-w-0">
        <p className="text-[15px] text-[var(--ink-soft)]">
          {l.descricao || (entrada ? "Entrada" : "Saída")}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted)]">
          <span>{fmtData(l.data)}</span>
          {l.categoria && (
            <span className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
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
        <MenuOpcoes
          align="end"
          itens={[
            { label: "Editar", onClick: onEditar },
            { label: "Excluir", onClick: onExcluir, destrutivo: true },
          ]}
        />
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
  calculadora_breakdown: CalculadoraBreakdown | null;
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
        .select("id, nome, preco_venda, preco_custo, calculadora_breakdown")
        .eq("user_id", userId)
        .eq("arquivado", false)
        .order("nome");
      return (data ?? []) as unknown as ProdutoVenda[];
    },
  });
  const produtos = produtosQuery.data ?? [];
  const produto = produtos.find((p) => p.id === produtoId) ?? null;
  // Produto criado pelo Planejamento nasce com preço 0 ("preço a definir"):
  // registrar a venda dele lançava uma entrada de R$ 0 no caixa.
  const semPreco = produto != null && !(Number(produto.preco_venda) > 0);
  // null quando não há custo cadastrado: antes o custo vazio virava 0 e a
  // frase "Dessa venda sobram..." aparecia sempre, com o preço inteiro como
  // sobra (QA-28). Também mostra o prejuízo, que antes saía "sobram R$ -5".
  const sobra = produto
    ? sobraDoProduto({
        precoVenda: Number(produto.preco_venda),
        precoCusto: produto.preco_custo != null ? Number(produto.preco_custo) : null,
        breakdown: produto.calculadora_breakdown,
      })
    : null;

  const salvar = async () => {
    if (!produto || semPreco) return;
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
      // Mesmo motivo do modal de lançamento: técnico no log, casa na tela.
      console.error("venda_produto_registrar", error);
      setErro("A Pólia One não conseguiu registrar a venda agora. Tenta de novo.");
      return;
    }
    track("venda_produto_registrada", { produto_id: produto.id });
    void registrar("feature_completed", { feature: "financeiro", propriedades: { acao: "venda" } });
    onSaved(
      sobra == null
        ? `Venda de "${produto.nome}" registrada.`
        : sobra.prejuizo
          ? `Venda de "${produto.nome}" registrada. Essa venda ficou ${fmtCentavos(-sobra.valor)} abaixo do custo.`
          : `Venda de "${produto.nome}" registrada. Dessa venda sobraram ${fmtCentavos(sobra.valor)}.`,
    );
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Registrar venda de um produto"
      description="Cria a entrada no caixa com o preço do catálogo."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !produto || semPreco}
            className={BTN_ACAO}
          >
            {salvando ? "Registrando..." : "Registrar venda"}
          </button>
        </>
      }
    >
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
            <Campo label="Produto">
              <select
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
              >
                <option value="">Escolha um produto</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} · {fmt(Number(p.preco_venda))}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="mb-4">
            <Campo label="Data">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
              />
            </Campo>
          </div>

          {produto && semPreco ? (
            <div className="mb-4 rounded-lg bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink-soft)]">
              Esse produto ainda está sem preço de venda. Defina o preço em{" "}
              <Link to="/produtos" className="text-[var(--secondary-text)] hover:underline">
                Produtos
              </Link>{" "}
              pra registrar a venda.
            </div>
          ) : produto && sobra?.prejuizo ? (
            <div className="mb-4 rounded-lg bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-[var(--danger)]">
              Com esse preço, a venda fica {fmtCentavos(-sobra.valor)} abaixo do custo direto.
            </div>
          ) : produto ? (
            <div className="mb-4 rounded-lg bg-[var(--secondary-light)] px-3 py-2.5 text-[13px] text-[var(--secondary-text)]">
              {sobra != null ? (
                <>Dessa venda sobram {fmtCentavos(sobra.valor)}, descontado o custo direto.</>
              ) : (
                <>Cadastre o custo desse produto pra ver quanto sobra.</>
              )}
            </div>
          ) : null}
        </>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}
