import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Abas from "@radix-ui/react-tabs";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  FileText,
  Lock,
  Upload,
  Wallet,
} from "lucide-react";
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
import { situacaoDaConta } from "@/lib/contasPagar";
import { listaAReceber } from "@/lib/contasReceber";
import { ehCompraDeEquipamento } from "@/lib/projecao.functions";
import { useContasPagar } from "@/components/financeiro/contasPagarDados";
import { useAReceber } from "@/components/financeiro/contasReceberDados";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { hojeISO } from "@/lib/data.functions";
import { formatarReais } from "@/lib/formatarReais";
import { numerosDoMes } from "@/lib/numerosDoMes";
import { legendaDoLucro, lucroDoMes } from "@/lib/lucroDoMes";
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
import { SecaoAReceber } from "@/components/financeiro/SecaoAReceber";
import { SecaoFechamento } from "@/components/financeiro/SecaoFechamento";
import { chaveDaForma, limitesDoMesISO, ROTULO_FORMA } from "@/lib/fechamentoDoMes";
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

type FiltroTipo = "todos" | "entrada" | "saida";

/**
 * Abas do Financeiro (23/11/2026, Sil: "ela tá bem confusa"). Antes eram 9
 * blocos empilhados e o histórico ficava no fim, depois de três telas.
 */
type AbaFinanceiro = "lancamentos" | "pagar" | "receber" | "fechamento";

// Âncoras que outras telas usam pra chegar aqui (Painel: "Ver contas"; sino:
// links das novidades). Abrem a aba certa.
const ABA_DA_ANCORA: Record<string, AbaFinanceiro> = {
  "#contas-a-pagar": "pagar",
  "#a-receber": "receber",
  "#fechamento": "fechamento",
};

/** 30 dias antes de hoje: o mesmo corte que as seções usam (mesma chave de cache). */
function trintaDiasAntes(hoje: string): string {
  const [a, m, d] = hoje.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - 30)).toISOString().slice(0, 10);
}

function nomeDoMes(anoMes: string): string {
  const [a, m] = anoMes.split("-").map(Number);
  if (!a || !m) return "";
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function FinanceiroPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate();

  // ── "Agora" só é lido no cliente pra não divergir da hidratação SSR (mesmo padrão de painel.tsx) ──
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  const hojeISOStr = useMemo(() => (clientReady ? hojeISO() : ""), [clientReady]);
  const mesDeHoje = hojeISOStr.slice(0, 7);

  // Um mês só pra tela inteira (cartões, lançamentos e fechamento). Antes o
  // histórico tinha "Este mês/Mês passado/Personalizado" e o fechamento outro
  // seletor, e dava pra estar olhando dois meses diferentes ao mesmo tempo.
  const [mesEscolhido, setMesEscolhido] = useState("");
  const anoMes = mesEscolhido || mesDeHoje;
  const [anoSel, mesSel] = anoMes ? anoMes.split("-").map(Number) : [0, 0];
  const ehMesDeHoje = !!anoMes && anoMes === mesDeHoje;

  const [aba, setAba] = useState<AbaFinanceiro>("lancamentos");
  useEffect(() => {
    const daAncora = () => {
      const alvo = ABA_DA_ANCORA[window.location.hash];
      if (alvo) setAba(alvo);
    };
    daAncora();
    window.addEventListener("hashchange", daAncora);
    return () => window.removeEventListener("hashchange", daAncora);
  }, []);

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

  // ── Filtro dos lançamentos ──
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");

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
            .select("id, tipo, valor, data, descricao, categoria, id_externo, forma, created_at")
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

  // ── Computado: mês escolhido no topo ──
  // Mesma conta do Painel e do "atual" da Meta do mês em Metas (numerosDoMes).
  const { entradas, saidas, numEntradasMes } = useMemo(() => {
    if (!anoSel) return { entradas: 0, saidas: 0, numEntradasMes: 0 };
    const n = numerosDoMes(lancamentos, anoSel, mesSel);
    return { entradas: n.entradas, saidas: n.saidas, numEntradasMes: n.registrosDeEntrada };
  }, [lancamentos, anoSel, mesSel]);

  // Lucro do mês: mesma conta do "Quanto lucrou" do Painel (lib/lucroDoMes,
  // 01/11/2026), que desconta o custo de cada produto vendido. Era entradas -
  // saídas, e a venda inteira aparecia como lucro em quem não tem saída.
  const periodoVendas = useMemo(
    () => (anoMes ? limitesDoMesISO(anoMes) : { de: "", ate: "" }),
    [anoMes],
  );
  const vendasMesQuery = useVendas(
    anoMes ? userId : undefined,
    periodoVendas.de,
    periodoVendas.ate,
  );
  const lucroInfo = useMemo(() => {
    if (!anoSel || vendasMesQuery.isLoading) return null;
    return lucroDoMes(
      lancamentos,
      vendasMesQuery.isError ? null : (vendasMesQuery.data ?? []),
      anoSel,
      mesSel,
    );
  }, [
    lancamentos,
    anoSel,
    mesSel,
    vendasMesQuery.isLoading,
    vendasMesQuery.isError,
    vendasMesQuery.data,
  ]);

  const lancamentosMes = useMemo(
    () => (anoMes ? lancamentos.filter((l) => l.data && l.data.slice(0, 7) === anoMes) : []),
    [lancamentos, anoMes],
  );

  // O cartão "Saiu" diz quanto foi equipamento: é a diferença que o lucro
  // deixa fora, e sem ela os dois cartões pareciam se contradizer.
  const { maiorSaidaCategoria, saidaEmEquipamento } = useMemo(() => {
    let maior: Lancamento | null = null;
    let equipamento = 0;
    for (const l of lancamentosMes) {
      if (l.tipo !== "saida") continue;
      if (ehCompraDeEquipamento(l.categoria)) equipamento += Number(l.valor) || 0;
      if (!maior || Number(l.valor) > Number(maior.valor)) maior = l;
    }
    return {
      maiorSaidaCategoria: maior?.categoria || (maior ? "Outros" : null),
      saidaEmEquipamento: Math.round(equipamento * 100) / 100,
    };
  }, [lancamentosMes]);

  // Contagem das abas: mesmas leituras (e mesmo cache) das seções.
  const corte = hojeISOStr ? trintaDiasAntes(hojeISOStr) : "";
  const contasPagarQuery = useContasPagar(userId, corte);
  const aReceberQuery = useAReceber(userId, corte);
  const contagemPagar = useMemo(() => {
    const abertas = (contasPagarQuery.data ?? []).filter((c) => c.status === "a_pagar");
    return {
      total: abertas.length,
      atrasadas: hojeISOStr
        ? abertas.filter((c) => situacaoDaConta(c.vencimento, hojeISOStr) === "atrasada").length
        : 0,
    };
  }, [contasPagarQuery.data, hojeISOStr]);
  const contagemReceber = useMemo(
    () =>
      aReceberQuery.data
        ? listaAReceber(aReceberQuery.data.contas, aReceberQuery.data.vendas).length
        : 0,
    [aReceberQuery.data],
  );

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

  // Categorias de entrada que ela já usa, pras contas a receber (ONE-207).
  const categoriasDeEntrada = useMemo(
    () => [
      ...new Set(
        lancamentos
          .filter((l) => l.tipo === "entrada" && l.categoria && l.categoria.trim())
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
  const lancamentosFiltrados = useMemo(
    () => lancamentosMes.filter((l) => filtroTipo === "todos" || l.tipo === filtroTipo),
    [lancamentosMes, filtroTipo],
  );

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

  const mesPorExtenso = nomeDoMes(anoMes);
  const classeCartaoRotulo =
    "text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]";
  const classeAba =
    "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-3 text-[14px] text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--secondary-text)] data-[state=active]:border-[var(--ink)] data-[state=active]:text-[var(--ink)]";
  const contador = (n: number, alerta = false) => (
    <span
      className={`rounded-full px-2 py-0.5 text-[12px] tabular-nums ${
        alerta
          ? "bg-[var(--danger-soft)] text-[var(--danger)]"
          : "bg-[var(--surface)] text-[var(--ink-soft)]"
      }`}
    >
      {n}
    </span>
  );

  return (
    <PaginaLogada
      largura="larga"
      eyebrow={mesPorExtenso ? `Mês · ${mesPorExtenso}` : "Este mês"}
      titulo="O dinheiro do mês."
      subtitulo="Tudo o que entrou e saiu, e quanto lucrou no fim."
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <span className="sr-only">Mês</span>
            <input
              type="month"
              value={anoMes}
              max={mesDeHoje || undefined}
              onChange={(e) => {
                if (!e.target.value) return;
                setMesEscolhido(e.target.value);
                track("financeiro_mes_trocado", { mes_de_hoje: e.target.value === mesDeHoje });
              }}
              className="min-h-11 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            />
          </label>
          <button type="button" onClick={() => abrirModal("entrada")} className={BTN_ACAO}>
            + Entrada
          </button>
          <button type="button" onClick={() => abrirModal("saida")} className={BTN_ACAO_CONTORNO}>
            + Saída
          </button>
          <button
            type="button"
            onClick={() => setModalVendaAberto(true)}
            className={BTN_ACAO_CONTORNO}
          >
            + Venda
          </button>
          <MenuOpcoes
            align="end"
            ariaLabel="Mais ações do Financeiro"
            trigger={
              <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)]">
                Mais
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            }
            itens={[
              { label: "Importar extrato", icone: Upload, onClick: () => setImportarAberto(true) },
              ehProjete
                ? {
                    label: "Resumo pro contador",
                    icone: FileText,
                    onClick: () => setResumoContadorAberto(true),
                  }
                : {
                    label: "Resumo pro contador (Pro)",
                    icone: Lock,
                    onClick: () =>
                      navigate({
                        to: "/upgrade",
                        search: { rota: "/financeiro/resumo", tier: tierDosNumeros() },
                      }),
                  },
            ]}
          />
        </div>
      }
    >
      <div>
        {/* ───────── 1. Os três números do mês ───────── */}
        <section className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Números do mês">
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className={classeCartaoRotulo}>Entrou</p>
            <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
              {fmt(entradas)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {numEntradasMes === 0
                ? "nenhuma entrada no mês"
                : `${numEntradasMes} ${numEntradasMes === 1 ? "entrada" : "entradas"}`}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className={classeCartaoRotulo}>Saiu</p>
            <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
              {fmt(saidas)}
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {saidaEmEquipamento > 0
                ? `${fmt(saidaEmEquipamento)} em compra de equipamento`
                : maiorSaidaCategoria
                  ? `maior saída: ${maiorSaidaCategoria}`
                  : "nenhuma saída no mês"}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <p className={classeCartaoRotulo}>Lucro do mês</p>
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

        {/* ───────── 2. Meta do mês ─────────
            Só no mês de hoje (a Meta do mês é a do mês corrente). Sem meta,
            uma linha; a régua grande só quando existe meta. */}
        {ehMesDeHoje &&
          (metaAlvo <= 0 ? (
            <p className="mt-4 text-[13px] text-[var(--muted)]">
              Sem Meta do mês por enquanto.{" "}
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
            <section className="mt-6 rounded-xl bg-[var(--surface)] p-6 md:p-8">
              <p className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                Onde o mês está agora
              </p>
              <ReguaDaMeta entradas={entradas} metaAlvo={metaAlvo} marcas={marcas} />
              {/* Até 31/10/2026 o texto mandava pro Planejamento (Quanto vale), que saiu
                  da Pólia One. As marcas continuam pra quem já tinha respondido. */}
              <p className="mt-0 text-[13px] text-[var(--muted)]">
                Essa barra acompanha a "Meta do mês", uma das suas metas em Metas.
                {marcas.length > 0 &&
                  " As marcas de mínimo e celebrar vêm das respostas que a marca já guardou."}
              </p>
            </section>
          ))}

        {/* ───────── 3. Abas ───────── */}
        <Abas.Root
          value={aba}
          onValueChange={(v) => {
            setAba(v as AbaFinanceiro);
            track("financeiro_aba", { aba: v });
          }}
          className="mt-8"
        >
          <Abas.List
            aria-label="Partes do Financeiro"
            className="flex flex-wrap gap-1 border-b border-[var(--line)]"
          >
            <Abas.Trigger value="lancamentos" className={classeAba}>
              Lançamentos {contador(lancamentosMes.length)}
            </Abas.Trigger>
            <Abas.Trigger value="pagar" className={classeAba}>
              A pagar {contador(contagemPagar.total, contagemPagar.atrasadas > 0)}
            </Abas.Trigger>
            <Abas.Trigger value="receber" className={classeAba}>
              A receber {contador(contagemReceber)}
            </Abas.Trigger>
            <Abas.Trigger value="fechamento" className={classeAba}>
              Fechamento
            </Abas.Trigger>
          </Abas.List>

          <Abas.Content value="lancamentos" className="focus-visible:outline-none">
            <div className="mt-4 flex flex-wrap gap-2">
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

            <div className="mt-4">
              {lancamentos.length === 0 ? (
                <Vazio
                  icone={Wallet}
                  titulo="Nenhum lançamento ainda."
                  texto="Cada entrada e saída registrada aqui vira o número de quanto a marca lucra no fim do mês."
                  acao={
                    <button
                      type="button"
                      onClick={() => abrirModal("entrada")}
                      className={BTN_ACAO}
                    >
                      Quero registrar a primeira
                    </button>
                  }
                />
              ) : lancamentosFiltrados.length === 0 ? (
                <Vazio
                  icone={Wallet}
                  denso
                  titulo={
                    filtroTipo === "todos"
                      ? `Nada lançado em ${mesPorExtenso}.`
                      : `Nenhuma ${filtroTipo === "entrada" ? "entrada" : "saída"} em ${mesPorExtenso}.`
                  }
                  texto="Troque o mês no topo da tela ou registre agora pelos botões de cima."
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
          </Abas.Content>

          <Abas.Content value="pagar" className="focus-visible:outline-none">
            {userId && (
              <SecaoContasPagar
                userId={userId}
                hoje={hojeISOStr}
                categoriasDoHistorico={categoriasDeSaida}
                onLancamentosMudaram={() =>
                  qc.invalidateQueries({ queryKey: ["financeiro", userId] })
                }
              />
            )}
          </Abas.Content>

          <Abas.Content value="receber" className="focus-visible:outline-none">
            {userId && (
              <SecaoAReceber
                userId={userId}
                hoje={hojeISOStr}
                categoriasDoHistorico={categoriasDeEntrada}
                onLancamentosMudaram={() =>
                  qc.invalidateQueries({ queryKey: ["financeiro", userId] })
                }
              />
            )}
          </Abas.Content>

          <Abas.Content value="fechamento" className="focus-visible:outline-none">
            {/* Só depois do "agora" do cliente: o mês vem de hoje até ela trocar. */}
            {userId && hojeISOStr && anoMes && (
              <SecaoFechamento
                userId={userId}
                hoje={hojeISOStr}
                anoMes={anoMes}
                lancamentos={lancamentos}
              />
            )}
          </Abas.Content>
        </Abas.Root>
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
            : lancamentoExcluir?.id_externo?.startsWith("venda:")
              ? "Essa entrada veio de uma venda. Excluir aqui tira o dinheiro do Financeiro e a venda sai do lucro do mês, mas continua em Vendas e o estoque não volta. Pra desfazer a venda inteira, cancele a venda em Vendas. Essa ação não pode ser desfeita."
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

/**
 * Nome na lista sem a categoria repetida na frente ("Compra de equipamento ·
 * Prensa" vira "Prensa"): a categoria já aparece na etiqueta da linha.
 */
function nomeDoLancamento(l: Lancamento): string {
  const d = l.descricao ?? "";
  const prefixo = l.categoria ? `${l.categoria} · ` : "";
  return prefixo && d.startsWith(prefixo) ? d.slice(prefixo.length) : d;
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
  // Entrada em turquesa e saída em vermelho (Sil, 23/11/2026: "as entradas
  // tivessem uma cor e as saídas outras"; "saídas podem ser em vermelho").
  // Tokens: o fundo claro no ícone e na etiqueta, o tom forte só no texto.
  const Icone = entrada ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border-b border-[var(--line)] px-3 py-4 transition-colors duration-150 hover:bg-white">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            entrada
              ? "bg-[var(--secondary-light)] text-[var(--secondary-text)]"
              : "bg-[var(--danger-soft)] text-[var(--danger)]"
          }`}
        >
          <Icone size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] text-[var(--ink-soft)]">
            <span className="sr-only">{entrada ? "Entrada: " : "Saída: "}</span>
            {nomeDoLancamento(l) || (entrada ? "Entrada" : "Saída")}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted)]">
            <span>{fmtData(l.data)}</span>
            {l.categoria && (
              <span className="rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
                {l.categoria}
              </span>
            )}
            {l.forma && (
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] text-[var(--ink-soft)] ${
                  entrada ? "bg-[var(--secondary-light)]" : "bg-[var(--danger-soft)]"
                }`}
              >
                {ROTULO_FORMA[chaveDaForma(l.forma)]}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <p
          className={`font-cabinet text-[19px] tabular-nums ${
            entrada ? "text-[var(--secondary-text)]" : "text-[var(--danger)]"
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
