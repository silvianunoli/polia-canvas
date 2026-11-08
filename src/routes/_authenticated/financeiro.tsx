import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Lock, Upload, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
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
import { hojeISO, mesAnoAtual, mesAnoDe, ehMesAtual } from "@/lib/data.functions";
import { formatarReais } from "@/lib/formatarReais";
import { numerosDoMes } from "@/lib/numerosDoMes";
import { legendaDoLucro, lucroDoMes } from "@/lib/lucroDoMes";
import { intervaloDoPeriodo } from "@/lib/vendas";
import { useVendas } from "@/components/vendas/dados";
import { ModalRegistrarVenda } from "@/components/vendas/ModalRegistrarVenda";
import { temNumerosDoMes, tierDosNumeros } from "@/lib/planos";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { ReguaDaMeta } from "@/components/financeiro/ReguaDaMeta";
import type { MarcaDaRegua } from "@/lib/reguaDaMeta";
import { ResumoContadorModal } from "@/components/financeiro/ResumoContadorModal";
// O modal de lançamento saiu daqui em 03/09/2026 (COPY-04): o Painel do plano Grátis
// também registra entrada/saída por ele, sem abrir esta tela.
import {
  ModalLancamento,
  type Lancamento,
  type RegistrarTipo,
} from "@/components/financeiro/ModalLancamento";
import { ModalImportar } from "@/components/financeiro/ModalImportar";
import { SecaoContasPagar } from "@/components/financeiro/SecaoContasPagar";
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

// Sempre com centavos no Financeiro ("R$ 0,00", "+ R$ 150,00"), decisão da Sil
// em 08/10/2026: antes "R$ 0" e "R$ 150" ficavam ao lado de "R$ 1.384,56".
// Formatador único do app desde 08/10/2026, aqui com as duas casas fixas.
const fmt = (valor: number) => formatarReais(valor, { sempreCentavos: true });
const fmtCentavos = fmt;

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
            .select("id, tipo, valor, data, descricao, categoria, id_externo, created_at")
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
  const ehProjete = temNumerosDoMes(perfilResumoQuery.data?.plano);
  const [resumoContadorAberto, setResumoContadorAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);

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
  // Mesma conta do Painel e do "atual" da Meta do mês em Metas (numerosDoMes).
  const { entradas, saidas, numEntradasMes } = useMemo(() => {
    if (!clientReady) return { entradas: 0, saidas: 0, numEntradasMes: 0 };
    const n = numerosDoMes(lancamentos, anoAtual, mesAtual);
    return { entradas: n.entradas, saidas: n.saidas, numEntradasMes: n.registrosDeEntrada };
  }, [lancamentos, clientReady, anoAtual, mesAtual]);

  // Lucro do mês: mesma conta do "Quanto lucrou" do Painel (lib/lucroDoMes,
  // 01/11/2026), que desconta o custo de cada produto vendido. Era entradas -
  // saídas, e a venda inteira aparecia como lucro em quem não tem saída.
  const periodoVendas = useMemo(
    () => (clientReady ? intervaloDoPeriodo("mes", new Date()) : { de: "", ate: "" }),
    [clientReady],
  );
  const vendasMesQuery = useVendas(
    clientReady ? userId : undefined,
    periodoVendas.de,
    periodoVendas.ate,
  );
  const lucroInfo = useMemo(() => {
    if (!clientReady || vendasMesQuery.isLoading) return null;
    return lucroDoMes(
      lancamentos,
      vendasMesQuery.isError ? null : (vendasMesQuery.data ?? []),
      anoAtual,
      mesAtual,
    );
  }, [
    lancamentos,
    clientReady,
    anoAtual,
    mesAtual,
    vendasMesQuery.isLoading,
    vendasMesQuery.isError,
    vendasMesQuery.data,
  ]);

  const lancamentosMes = useMemo(() => {
    if (!clientReady) return [];
    return lancamentos.filter((l) => l.data && ehMesAtual(l.data));
  }, [lancamentos, clientReady]);

  const maiorSaidaCategoria = useMemo(() => {
    let maior: Lancamento | null = null;
    for (const l of lancamentosMes) {
      if (l.tipo !== "saida") continue;
      if (!maior || Number(l.valor) > Number(maior.valor)) maior = l;
    }
    return maior?.categoria || (maior ? "Outros" : null);
  }, [lancamentosMes]);

  // Categorias de saída que ela já usa, pras contas a pagar (ONE-127).
  const categoriasDeSaida = useMemo(
    () => [
      ...new Set(
        lancamentos
          .filter((l) => l.tipo === "saida" && l.categoria && l.categoria.trim())
          .map((l) => l.categoria!.trim()),
      ),
    ],
    [lancamentos],
  );

  // ── Marcas da régua (leitura, vêm do Módulo 4 do Planejamento) ──
  // "mês bom" (financeiro.meta_boa) não entra aqui: é a própria Meta do mês,
  // já o denominador da barra (metaAlvo), não uma marca adicional.
  const marcas = useMemo(() => {
    const lista: MarcaDaRegua[] = [];
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
      subtitulo="Tudo o que entrou e saiu, e quanto lucrou no fim."
      acao={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportarAberto(true)}
            className={BTN_ACAO_CONTORNO}
          >
            <Upload size={14} aria-hidden="true" />
            Importar extrato
          </button>
          {ehProjete ? (
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
              search={{ rota: "/financeiro/resumo", tier: tierDosNumeros() }}
              className={`${BTN_ACAO_CONTORNO} text-[var(--muted)]`}
            >
              <Lock size={14} aria-hidden="true" />
              Resumo pro contador
            </Link>
          )}
        </div>
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
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {numEntradasMes === 0
                ? "nenhuma entrada ainda"
                : `${numEntradasMes} ${numEntradasMes === 1 ? "registro" : "registros"}`}
            </p>
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
              Lucro do mês
            </p>
            <p
              className={`font-cabinet mt-1 text-[32px] leading-none ${
                lucroInfo && lucroInfo.valor < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"
              }`}
            >
              {lucroInfo ? fmt(lucroInfo.valor) : "..."}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {lucroInfo ? legendaDoLucro(lucroInfo) : "lendo as vendas do mês"}
            </p>
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
              {/* A régua acha a meta pelo nome exato "Meta do mês": o link abre
                  em Metas o atalho que já cria com esse nome e em R$. */}
              <LinkInterno
                href="/metas?criar=meta-do-mes"
                className="inline-flex min-h-11 items-center text-[var(--secondary-text)] hover:underline"
              >
                Criar a Meta do mês →
              </LinkInterno>
            </p>
          ) : (
            <ReguaDaMeta entradas={entradas} metaAlvo={metaAlvo} marcas={marcas} />
          )}

          {/* Até 31/10/2026 o texto mandava pro Planejamento (Quanto vale), que saiu
              da Pólia One. As marcas continuam pra quem já tinha respondido. */}
          <p className="mt-0 text-[13px] text-[var(--muted)]">
            Essa barra acompanha a "Meta do mês", uma das suas metas em Metas.
            {marcas.length > 0 &&
              " As marcas de mínimo e celebrar vêm das respostas que a marca já guardou."}
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
            + Registrar venda
          </button>
          <button type="button" onClick={() => abrirModal("saida")} className={BTN_ACAO_CONTORNO}>
            + Registrar saída
          </button>
        </section>

        {/* ───────── Contas a pagar (ONE-127) ───────── */}
        {userId && (
          <SecaoContasPagar
            userId={userId}
            hoje={hojeISOStr}
            categoriasDoHistorico={categoriasDeSaida}
            onLancamentosMudaram={() => qc.invalidateQueries({ queryKey: ["financeiro", userId] })}
          />
        )}

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
                texto="Cada entrada e saída registrada aqui vira o número de quanto a marca lucra no fim do mês."
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

      {/* ───────── 6. Modal: registrar venda ─────────
          Até 01/11/2026 era um modal próprio que só lançava a entrada pelo
          preço do catálogo, sem venda ligada: o "Quanto lucrou" contava ela
          inteira, sem o custo do produto (ONE-166). Agora é o mesmo formulário
          de Vendas, que guarda o custo de cada item, baixa o estoque e lança
          o dinheiro no Financeiro. O modal já avisa sozinho. */}
      {modalVendaAberto && userId && (
        <ModalRegistrarVenda
          userId={userId}
          onClose={() => setModalVendaAberto(false)}
          onSaved={() => {
            setModalVendaAberto(false);
            void qc.invalidateQueries();
          }}
        />
      )}

      {/* ───────── Modal: importar extrato, planilha ou nota (ONE-124) ───────── */}
      {importarAberto && userId && (
        <ModalImportar
          userId={userId}
          lancamentos={lancamentos}
          cnpj={perfilResumoQuery.data?.cnpj ?? null}
          onClose={() => setImportarAberto(false)}
          onMudou={() => qc.invalidateQueries({ queryKey: ["financeiro", userId] })}
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
        descricao={
          lancamentoExcluir?.id_externo?.startsWith("equipamento:")
            ? "Essa ação não pode ser desfeita. O equipamento volta pra planejado na aba Equipamentos."
            : "Essa ação não pode ser desfeita."
        }
        textoConfirmar="Excluir"
        destrutivo
        carregando={excluindoLancamento}
        textoCarregando="Excluindo…"
        onConfirmar={confirmarExcluirLancamento}
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
