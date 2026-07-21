import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  CalendarDays,
  Clock,
  Target,
  Pencil,
  X,
} from "lucide-react";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

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

interface BoardSearch {
  filtro?: "today" | "7" | "30" | "all";
}

export const Route = createFileRoute("/_authenticated/planner/$slug")({
  validateSearch: (search: Record<string, unknown>): BoardSearch => {
    const f = search.filtro;
    const valido = f === "today" || f === "7" || f === "30" || f === "all";
    return { filtro: valido ? f : undefined };
  },
  head: () => ({
    meta: [{ title: "Quadro · Pólia" }],
  }),
  component: PlannerBoard,
});

const COLUNAS_BASE = [
  { id: "ideias", label: "Ideias & pendências", done: false },
  { id: "planejado", label: "Planejado", done: false },
  { id: "hoje", label: "Hoje", done: false },
  { id: "em_progresso", label: "Em progresso", done: false },
  { id: "pausado", label: "Pausado", done: false },
  { id: "concluido", label: "Pronto", done: true },
] as const;

type ColId = (typeof COLUNAS_BASE)[number]["id"];
const COL_IDS = COLUNAS_BASE.map((c) => c.id) as string[];

const PROXIMA: Record<ColId, ColId> = {
  ideias: "planejado",
  planejado: "hoje",
  hoje: "em_progresso",
  em_progresso: "concluido",
  pausado: "em_progresso",
  concluido: "concluido",
};

// Prioridade usa os tokens v3 (sem fill colorido grande): baixa discreta,
// média em destaque, alta em alerta.
const PRIORIDADES = [
  { v: "baixa", label: "Baixa", cor: "var(--muted)" },
  { v: "media", label: "Média", cor: "var(--highlight)" },
  { v: "alta", label: "Alta", cor: "var(--danger)" },
];
const corPrioridade = (v: string | null) =>
  PRIORIDADES.find((p) => p.v === v)?.cor ?? "var(--line)";
const proxPrioridade = (v: string | null) => {
  const i = PRIORIDADES.findIndex((p) => p.v === v);
  return PRIORIDADES[(i + 1) % PRIORIDADES.length].v;
};

// Tags: livres, incluídas/excluídas por cartão (sem lista pré-estabelecida).
// Cor por hash do texto — mesma tag sempre cai na mesma cor, sem precisar cadastrar nada.
const PALETA_TAGS = [
  "var(--secondary)",
  "var(--accent)",
  "var(--cat-vendas)",
  "var(--cat-admin)",
  "var(--highlight)",
];
function corDaTag(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return PALETA_TAGS[h % PALETA_TAGS.length];
}

const FILTROS = [
  { id: "today", label: "Hoje" },
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "all", label: "Tudo" },
] as const;
type FiltroId = (typeof FILTROS)[number]["id"];

interface Card {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string | null;
  prazo: string | null;
  data_inicio: string | null;
  horario: string | null;
  horas_por_dia: number | null;
  meta_id: string | null;
  notas_execucao: string | null;
  tags: string[];
  assigned_to: string | null;
  created_at: string;
}

function fmtDDMM(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtDataCompleta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Construção local (não UTC) — new Date("YYYY-MM-DD") interpretaria como UTC
// meia-noite e podia voltar um dia em fusos negativos (Brasil).
function dataDeIso(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoDeData(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function colunaDoCard(status: string): ColId {
  return (COL_IDS.includes(status) ? status : "ideias") as ColId;
}

function hojeISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function vencido(c: Card): boolean {
  return colunaDoCard(c.status) !== "concluido" && !!c.prazo && c.prazo < hojeISO();
}

// Regra do filtro: o intervalo início-fim do cartão intercepta o período.
// Vencidos não concluídos aparecem em qualquer período. Sem datas, só em Tudo.
function visivel(c: Card, filtro: FiltroId): boolean {
  if (filtro === "all") return true;
  if (!c.data_inicio || !c.prazo) return false;
  if (vencido(c)) return true;
  const hoje = hojeISO();
  const pFim = filtro === "today" ? hoje : addDias(hoje, Number(filtro) - 1);
  return c.data_inicio <= pFim && c.prazo >= hoje;
}

function PlannerBoard() {
  const { slug } = Route.useParams();
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const reduceMotion = usePrefersReducedMotion();

  const quadroQuery = useQuery({
    queryKey: ["quadro", userId, slug],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quadros")
        .select("id, nome, slug")
        .eq("user_id", userId!)
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  const quadroId = quadroQuery.data?.id;

  const colunasQuery = useQuery({
    queryKey: ["quadro-colunas", quadroId],
    enabled: !!quadroId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quadro_colunas" as never)
        .select("coluna_id, nome")
        .eq("quadro_id", quadroId!);
      return ((data ?? []) as unknown as { coluna_id: string; nome: string }[]).reduce(
        (m, r) => m.set(r.coluna_id, r.nome),
        new Map<string, string>(),
      );
    },
  });
  const nomesColunas = colunasQuery.data ?? new Map<string, string>();
  const nomeColuna = (id: ColId) =>
    nomesColunas.get(id) ?? COLUNAS_BASE.find((c) => c.id === id)!.label;

  const cardsQuery = useQuery({
    queryKey: ["quadro-tarefas", quadroId],
    enabled: !!quadroId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select(
          "id, titulo, descricao, status, prioridade, prazo, data_inicio, horario, horas_por_dia, meta_id, notas_execucao, assigned_to, created_at, tags",
        )
        .eq("quadro_id", quadroId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Card[];
    },
  });

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);

  const metasQuery = useQuery({
    queryKey: ["metas-ativas-planner", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("id, titulo")
        .eq("user_id", userId!)
        .eq("status", "ativa")
        .order("created_at", { ascending: false });
      return (data ?? []) as { id: string; titulo: string }[];
    },
  });
  const metas = metasQuery.data ?? [];
  const metaTitulo = (id: string | null) => metas.find((m) => m.id === id)?.titulo ?? null;

  const membrosQuery = useQuery({
    queryKey: ["equipe-ativa", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("equipe_membros")
        .select("id, nome")
        .eq("user_id", userId!)
        .eq("status", "ativo")
        .order("nome", { ascending: true });
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const membros = membrosQuery.data ?? [];

  const search = Route.useSearch();
  const [filtro, setFiltro] = useState<FiltroId>(search.filtro ?? "all");
  const shown = useMemo(() => cards.filter((c) => visivel(c, filtro)), [cards, filtro]);
  const total = cards.length;
  const prontos = cards.filter((c) => colunaDoCard(c.status) === "concluido").length;
  const doneShown = shown.filter((c) => colunaDoCard(c.status) === "concluido").length;
  const pctShown = shown.length ? Math.round((doneShown / shown.length) * 100) : 0;

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [composerCol, setComposerCol] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [renomeandoCol, setRenomeandoCol] = useState<ColId | null>(null);
  const [nomeRename, setNomeRename] = useState("");
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  // ---- Painel de detalhe ----
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [dTitulo, setDTitulo] = useState("");
  const [dTags, setDTags] = useState<string[]>([]);
  const [dTagInput, setDTagInput] = useState("");
  const [dDesc, setDDesc] = useState("");
  const [dInicio, setDInicio] = useState("");
  const [dFim, setDFim] = useState("");
  const [dHorario, setDHorario] = useState("");
  const [dHpd, setDHpd] = useState("");
  const [dMetaId, setDMetaId] = useState("");
  const [dNota, setDNota] = useState("");
  const [dColuna, setDColuna] = useState<ColId>("ideias");
  const [delArmado, setDelArmado] = useState(false);
  const [inicioAberto, setInicioAberto] = useState(false);
  const [fimAberto, setFimAberto] = useState(false);

  const updateLocal = (mut: (l: Card[]) => Card[]) =>
    qc.setQueryData<Card[]>(["quadro-tarefas", quadroId], (old) => mut(old ?? []));
  const invalidar = () => qc.invalidateQueries({ queryKey: ["quadro-tarefas", quadroId] });

  const mover = async (id: string, status: ColId) => {
    updateLocal((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    const { error } = await supabase
      .from("tarefas")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toastErro("Não consegui mover o cartão. Tenta de novo.");
      invalidar();
      return;
    }
    if (status === "concluido") track("tarefa_concluida");
  };

  const mudarPrioridade = async (id: string, prioridade: string) => {
    updateLocal((l) => l.map((c) => (c.id === id ? { ...c, prioridade } : c)));
    const { error } = await supabase.from("tarefas").update({ prioridade }).eq("id", id);
    if (error) {
      toastErro("Não consegui mudar a prioridade.");
      invalidar();
    }
  };

  const mudarAssignee = async (id: string, assignee: string) => {
    const valor = assignee || null;
    updateLocal((l) => l.map((c) => (c.id === id ? { ...c, assigned_to: valor } : c)));
    const { error } = await supabase.from("tarefas").update({ assigned_to: valor }).eq("id", id);
    if (error) {
      toastErro("Não consegui salvar o responsável.");
      invalidar();
    }
  };

  const deletar = async (id: string) => {
    updateLocal((l) => l.filter((c) => c.id !== id));
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) {
      toastErro("Não consegui remover o cartão.");
      invalidar();
    }
  };

  const concluirComTransicao = (id: string) => {
    if (reduceMotion) {
      mover(id, "concluido");
      return;
    }
    setLeavingIds((s) => new Set(s).add(id));
    setTimeout(() => {
      mover(id, "concluido");
      setLeavingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 200);
  };

  // ---- Renomear coluna ----
  const salvarNomeColuna = async (colId: ColId) => {
    const nome = nomeRename.trim();
    setRenomeandoCol(null);
    if (!nome || !quadroId) return;
    const { error } = await supabase.from("quadro_colunas" as never).upsert(
      {
        quadro_id: quadroId,
        coluna_id: colId,
        nome,
        updated_at: new Date().toISOString(),
      } as never,
      {
        onConflict: "quadro_id,coluna_id",
      },
    );
    if (error) {
      toastErro("Não consegui renomear a coluna.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["quadro-colunas", quadroId] });
  };

  // ---- Painel de detalhe ----
  // Snapshot dos valores ao abrir. Sem ele, fechar sem editar reescrevia o cartão inteiro —
  // e em cartão legado com data_inicio/prazo nulos, o fallback hojeISO() gravava "hoje" só
  // por ter visitado o cartão (aparecia como vencido/hoje nos filtros). Só grava se mudou.
  const snapshotDetalheRef = useRef<string>("");
  const assinaturaDetalhe = (v: {
    titulo: string;
    tags: string[];
    desc: string;
    inicio: string;
    fim: string;
    horario: string;
    hpd: string;
    metaId: string;
    nota: string;
    coluna: string;
    tagInput: string;
  }) => JSON.stringify(v);

  const abrirDetalhe = (c: Card) => {
    setDetalheId(c.id);
    setDTitulo(c.titulo);
    setDTags(c.tags ?? []);
    setDTagInput("");
    setDDesc(c.descricao ?? "");
    setDInicio(c.data_inicio ?? "");
    setDFim(c.prazo ?? "");
    setDHorario(c.horario ?? "");
    setDHpd(c.horas_por_dia != null ? String(c.horas_por_dia) : "");
    setDMetaId(c.meta_id ?? "");
    setDNota(c.notas_execucao ?? "");
    setDColuna(colunaDoCard(c.status));
    setDelArmado(false);
    snapshotDetalheRef.current = assinaturaDetalhe({
      titulo: c.titulo,
      tags: c.tags ?? [],
      desc: c.descricao ?? "",
      inicio: c.data_inicio ?? "",
      fim: c.prazo ?? "",
      horario: c.horario ?? "",
      hpd: c.horas_por_dia != null ? String(c.horas_por_dia) : "",
      metaId: c.meta_id ?? "",
      nota: c.notas_execucao ?? "",
      coluna: colunaDoCard(c.status),
      tagInput: "",
    });
  };

  // Enter ou perder o foco confirmam a tag digitada — sem isso, texto digitado
  // e nunca confirmado (ex: clicou direto em "Salvar e fechar") se perdia.
  const adicionarTagPendente = () => {
    const nova = dTagInput.trim();
    if (!nova) return;
    setDTags((t) => (t.some((x) => x.toLowerCase() === nova.toLowerCase()) ? t : [...t, nova]));
    setDTagInput("");
  };

  const fecharDetalhe = async () => {
    const id = detalheId;
    if (!id) return;
    const atual = cards.find((c) => c.id === id);
    setDetalheId(null);
    setDelArmado(false);
    if (!atual) return;

    // Nada mudou desde o abrir → fecha sem tocar no banco. Evita reescrever (e "carimbar"
    // datas em) um cartão que a usuária só abriu pra olhar.
    const assinaturaAtual = assinaturaDetalhe({
      titulo: dTitulo,
      tags: dTags,
      desc: dDesc,
      inicio: dInicio,
      fim: dFim,
      horario: dHorario,
      hpd: dHpd,
      metaId: dMetaId,
      nota: dNota,
      coluna: dColuna,
      tagInput: dTagInput,
    });
    if (assinaturaAtual === snapshotDetalheRef.current) return;

    // Obrigatórios: campo vazio no fechar volta ao valor anterior, não fica em branco.
    const tituloFinal = dTitulo.trim() || atual.titulo;
    // Rede de segurança: se o blur não disparou a tempo (ex.: Escape), inclui
    // o texto ainda digitado no input de tag como se tivesse sido confirmado.
    const tagPendente = dTagInput.trim();
    const tagsFinal =
      tagPendente && !dTags.some((t) => t.toLowerCase() === tagPendente.toLowerCase())
        ? [...dTags, tagPendente]
        : dTags;
    const inicioFinal = dInicio || atual.data_inicio || hojeISO();
    let fimFinal = dFim || atual.prazo || hojeISO();
    if (fimFinal < inicioFinal) fimFinal = inicioFinal; // fim nunca antes do início
    const horarioFinal = dHorario || null;
    const hpdFinal = dHpd.trim() ? Number(dHpd) : null;
    const metaFinal = dMetaId || null;
    const notaFinal = dNota;
    const descFinal = dDesc;
    const statusFinal = dColuna;

    updateLocal((l) =>
      l.map((c) =>
        c.id === id
          ? {
              ...c,
              titulo: tituloFinal,
              tags: tagsFinal,
              descricao: descFinal,
              data_inicio: inicioFinal,
              prazo: fimFinal,
              horario: horarioFinal,
              horas_por_dia: hpdFinal,
              meta_id: metaFinal,
              notas_execucao: notaFinal,
              status: statusFinal,
            }
          : c,
      ),
    );
    const { error } = await supabase
      .from("tarefas")
      .update({
        titulo: tituloFinal,
        tags: tagsFinal,
        descricao: descFinal,
        data_inicio: inicioFinal,
        prazo: fimFinal,
        horario: horarioFinal,
        horas_por_dia: hpdFinal,
        meta_id: metaFinal,
        notas_execucao: notaFinal,
        status: statusFinal,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) {
      toastErro("Não consegui salvar as alterações do cartão.");
      invalidar();
    }
  };

  const excluirDoDetalhe = () => {
    if (!delArmado) {
      setDelArmado(true);
      return;
    }
    if (detalheId) deletar(detalheId);
    setDetalheId(null);
    setDelArmado(false);
  };

  useEffect(() => {
    if (!detalheId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharDetalhe();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalheId, dTitulo, dTags, dDesc, dInicio, dFim, dHorario, dHpd, dMetaId, dNota, dColuna]);

  const cardEmDetalhe = cards.find((c) => c.id === detalheId) ?? null;
  const cardConfirmando = cards.find((c) => c.id === confirmarId) ?? null;

  // Quick add: Enter salva só com o nome; obrigatórios preenchidos por padrão
  // (categoria mais usada do quadro, início e fim = hoje). Ajuste fino no detalhe.
  const criar = async (status: string) => {
    const titulo = novoTitulo.trim();
    if (!titulo || !userId || !quadroId) return;
    const hoje = hojeISO();
    const { error } = await supabase.from("tarefas").insert({
      user_id: userId,
      quadro_id: quadroId,
      titulo,
      status,
      fonte: "manual",
      data_inicio: hoje,
      prazo: hoje,
    } as never);
    if (error) {
      toastErro("Não consegui salvar o cartão. Tenta de novo.");
      return;
    }
    track("tarefa_criada", { status });
    setNovoTitulo("");
    setComposerCol(null);
    invalidar();
  };

  const apagarQuadro = async () => {
    if (!quadroId) return;
    if (!window.confirm("Apagar este quadro e todos os cartões dele? Não dá pra desfazer.")) return;
    const { error } = await supabase.from("quadros").delete().eq("id", quadroId);
    if (error) {
      toastErro("Não consegui apagar o quadro. Tenta de novo.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["quadros", userId] });
    navigate({ to: "/planner" });
  };

  if (!quadroQuery.isLoading && !quadroQuery.data) {
    return (
      <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <PainelNav navActive="/planner" />
        <main className="mx-auto max-w-[600px] px-6 py-20 text-center">
          <p className="font-cabinet mb-4 text-[24px] text-[var(--ink)]">Quadro não encontrado</p>
          <a href="/planner" className="text-[14px] text-[var(--secondary-text)] hover:underline">
            ← voltar ao Planner
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav navActive="/planner" />

      <section className="px-6 pb-5 pt-8 md:px-10">
        <div className="mx-auto max-w-[1400px]">
          <a
            href="/planner"
            className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Planner
          </a>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-cabinet mb-1 text-[clamp(28px,5vw,40px)] leading-tight text-[var(--ink)]">
                {quadroQuery.data?.nome ?? "Quadro"}
              </h1>
              <p className="italic text-[var(--ink-soft)]">
                {total === 0
                  ? "nenhum cartão ainda, comece por uma ideia."
                  : `${total} ${total === 1 ? "cartão" : "cartões"} · ${prontos} ${prontos === 1 ? "pronto" : "prontos"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={apagarQuadro}
              aria-label="Apagar quadro"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </div>

          {/* Filtro de período */}
          <div className="mt-5 inline-flex gap-1 rounded-[10px] border border-[var(--line)] bg-white p-1">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  filtro === f.id
                    ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Barra de progresso do conjunto filtrado */}
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3">
            <span className="shrink-0 text-[13px] text-[var(--muted)]">Progresso</span>
            <span className="w-9 shrink-0 text-[13px] font-semibold text-[var(--ink-soft)]">
              {pctShown}%
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className="h-full rounded-full bg-[var(--secondary)] transition-all duration-300"
                style={{ width: `${pctShown}%` }}
              />
            </div>
            <span className="shrink-0 text-[13px] text-[var(--ink-soft)]">
              {doneShown} de {shown.length} concluída
              {doneShown === 1 && shown.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </section>

      {/* Kanban — 6 colunas com scroll horizontal. O scroll fica DENTRO do container
          mx-auto max-w-1400, senão o overflow rompe o centralizado e desalinha do cabeçalho. */}
      <section className="px-6 pb-16 md:px-10">
        <div className="mx-auto max-w-[1400px] overflow-x-auto">
          <div className="flex min-w-max gap-4 pb-1">
            {COLUNAS_BASE.map((col) => {
              const listaTotal = cards.filter((c) => colunaDoCard(c.status) === col.id);
              const lista = shown.filter((c) => colunaDoCard(c.status) === col.id);
              const ativa = overCol === col.id;
              const renomeando = renomeandoCol === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(col.id);
                  }}
                  onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                  onDrop={() => {
                    if (draggedId) {
                      mover(draggedId, col.id);
                      setDraggedId(null);
                      setOverCol(null);
                    }
                  }}
                  className={`flex w-[280px] shrink-0 flex-col rounded-xl border p-3 transition-colors ${
                    ativa
                      ? "border-[var(--secondary)] bg-[var(--secondary-light)]"
                      : "border-[var(--line)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-1.5">
                    {renomeando ? (
                      <input
                        autoFocus
                        defaultValue={nomeColuna(col.id)}
                        onChange={(e) => setNomeRename(e.target.value)}
                        onFocus={(e) => setNomeRename(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") salvarNomeColuna(col.id);
                          if (e.key === "Escape") setRenomeandoCol(null);
                        }}
                        onBlur={() => salvarNomeColuna(col.id)}
                        className="w-full rounded-md border border-[var(--secondary)] bg-white px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)] outline-none"
                      />
                    ) : (
                      <>
                        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                          {nomeColuna(col.id)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNomeRename(nomeColuna(col.id));
                              setRenomeandoCol(col.id);
                            }}
                            aria-label="Renomear coluna"
                            title="Renomear coluna"
                            className="rounded p-0.5 text-[var(--muted)] opacity-0 transition-opacity hover:bg-white hover:text-[var(--ink)] group-hover/col:opacity-100"
                          >
                            <Pencil size={12} aria-hidden="true" />
                          </button>
                          <span className="rounded-md border border-[var(--line)] bg-white px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                            {lista.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerCol(col.id);
                              setNovoTitulo("");
                            }}
                            aria-label={`Adicionar cartão em ${nomeColuna(col.id)}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-white hover:text-[var(--secondary-text)]"
                          >
                            <Plus size={16} aria-hidden="true" />
                          </button>
                        </span>
                      </>
                    )}
                  </div>

                  {composerCol === col.id && (
                    <div className="mb-3 rounded-xl border border-[var(--line)] bg-white p-2.5">
                      <input
                        type="text"
                        autoFocus
                        value={novoTitulo}
                        onChange={(e) => setNovoTitulo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") criar(col.id);
                          if (e.key === "Escape") setComposerCol(null);
                        }}
                        maxLength={200}
                        placeholder="Nome do cartão · Enter salva, Esc cancela"
                        className="w-full rounded-lg border border-[var(--line)] px-2.5 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="group/col flex flex-col gap-2.5">
                    {lista.length === 0 && composerCol !== col.id ? (
                      <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center">
                        <p className="text-[13px] italic text-[var(--muted)]">
                          {listaTotal.length ? "nada neste período" : "arraste um cartão pra cá"}
                        </p>
                      </div>
                    ) : (
                      lista.map((c) => {
                        const late = vencido(c);
                        const saindo = leavingIds.has(c.id);
                        const concluido = colunaDoCard(c.status) === "concluido";
                        const meta = metaTitulo(c.meta_id);
                        return (
                          <article
                            key={c.id}
                            draggable
                            onDragStart={() => setDraggedId(c.id)}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setOverCol(null);
                            }}
                            onClick={() => abrirDetalhe(c)}
                            className="group cursor-grab rounded-xl border border-[var(--line)] bg-white p-3 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:cursor-grabbing"
                            style={
                              saindo ? { opacity: 0, transform: "translateX(12px)" } : undefined
                            }
                          >
                            {c.tags.length > 0 && (
                              <div className="mb-1.5 flex flex-wrap gap-1">
                                {c.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]"
                                  >
                                    <span
                                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                                      style={{ background: corDaTag(tag) }}
                                      aria-hidden="true"
                                    />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mb-2 flex items-start gap-2">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={concluido}
                                aria-label={
                                  concluido ? "Marcar como não concluído" : "Marcar como concluído"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (concluido) {
                                    mover(c.id, "hoje");
                                    return;
                                  }
                                  setConfirmarId(c.id);
                                }}
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                                  concluido
                                    ? "border-[var(--secondary)] bg-[var(--secondary)]"
                                    : "border-[var(--muted)] hover:border-[var(--secondary-text)] hover:bg-[var(--secondary-light)]"
                                }`}
                              />
                              <p
                                className={`text-[14px] leading-snug ${
                                  concluido
                                    ? "text-[var(--muted)] line-through"
                                    : "text-[var(--ink)]"
                                }`}
                              >
                                {c.titulo}
                              </p>
                            </div>

                            {/* Chips: período, horário, horas/dia, meta vinculada */}
                            {(c.data_inicio || c.prazo || c.horario || c.horas_por_dia || meta) && (
                              <div className="mb-2 flex flex-wrap gap-1">
                                {c.data_inicio && c.prazo && (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${
                                      late
                                        ? "border border-[var(--danger)] text-[var(--danger)]"
                                        : "bg-[var(--surface)] text-[var(--ink-soft)]"
                                    }`}
                                  >
                                    <CalendarDays size={11} aria-hidden="true" />
                                    {c.data_inicio === c.prazo
                                      ? `prazo ${fmtDDMM(c.prazo)}`
                                      : `${fmtDDMM(c.data_inicio)} a ${fmtDDMM(c.prazo)}`}
                                    {late ? " · vencido" : ""}
                                  </span>
                                )}
                                {c.horario && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
                                    <Clock size={11} aria-hidden="true" />
                                    {c.horario}
                                  </span>
                                )}
                                {c.horas_por_dia != null && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
                                    <Clock size={11} aria-hidden="true" />
                                    {c.horas_por_dia}h/dia
                                  </span>
                                )}
                                {meta && (
                                  <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
                                    <Target size={11} className="shrink-0" aria-hidden="true" />
                                    <span className="truncate">{meta}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              {/* Prioridade — clique cicla */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  mudarPrioridade(c.id, proxPrioridade(c.prioridade));
                                }}
                                title="Mudar prioridade"
                                aria-label="Mudar prioridade"
                                className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ background: corPrioridade(c.prioridade) }}
                                  aria-hidden="true"
                                />
                              </button>

                              <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                {col.id !== "concluido" && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      mover(c.id, PROXIMA[col.id]);
                                    }}
                                    aria-label="Avançar"
                                    title="Avançar"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--secondary-text)] hover:bg-[var(--secondary-light)]"
                                  >
                                    <ArrowRight size={14} aria-hidden="true" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deletar(c.id);
                                  }}
                                  aria-label="Remover cartão"
                                  title="Remover"
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                                >
                                  <Trash2 size={13} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                            {membros.length > 0 && (
                              <select
                                value={c.assigned_to ?? ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => mudarAssignee(c.id, e.target.value)}
                                className={`mt-2 w-full rounded-lg border px-2 py-1 text-[12px] focus:outline-none ${
                                  c.assigned_to
                                    ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                                    : "border-[var(--line)] text-[var(--muted)]"
                                }`}
                              >
                                <option value="">Sem responsável</option>
                                {membros.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.nome}
                                  </option>
                                ))}
                              </select>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Overlay + painel de detalhe do cartão */}
      <div
        onClick={fecharDetalhe}
        aria-hidden="true"
        className="fixed inset-0 z-30 bg-[rgba(10,10,10,0.18)] transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          opacity: detalheId ? 1 : 0,
          pointerEvents: detalheId ? "auto" : "none",
        }}
      />
      <aside
        role="dialog"
        aria-label="Detalhe do cartão"
        aria-hidden={!detalheId}
        className="fixed top-0 z-40 h-screen w-[400px] max-w-[92vw] overflow-y-auto border-l border-[var(--line)] bg-white p-6 transition-[right] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ right: detalheId ? 0 : -420 }}
      >
        {cardEmDetalhe && (
          <>
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              Cartão
            </p>
            <input
              value={dTitulo}
              onChange={(e) => setDTitulo(e.target.value)}
              placeholder="Título do cartão (obrigatório)"
              className="w-full border-0 border-b border-[var(--line)] bg-transparent py-2 text-[22px] text-[var(--ink)] outline-none focus:border-[var(--secondary)]"
            />

            <div className="mt-5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                Tags
              </p>
              {dTags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {dTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1 pl-2.5 pr-1.5 text-[13px] text-[var(--ink-soft)]"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: corDaTag(tag) }}
                        aria-hidden="true"
                      />
                      {tag}
                      <button
                        type="button"
                        onClick={() => setDTags((t) => t.filter((x) => x !== tag))}
                        aria-label={`Remover tag ${tag}`}
                        className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                value={dTagInput}
                onChange={(e) => setDTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  adicionarTagPendente();
                }}
                onBlur={adicionarTagPendente}
                maxLength={30}
                placeholder="Nova tag · Enter adiciona"
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
              />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                Descrição
              </p>
              <textarea
                value={dDesc}
                onChange={(e) => setDDesc(e.target.value)}
                rows={2}
                placeholder="O que é esta entrega"
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                  Início <span className="text-[var(--danger)]">*</span>
                </p>
                <Popover open={inicioAberto} onOpenChange={setInicioAberto}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-left text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
                    >
                      {dInicio ? fmtDataCompleta(dInicio) : "Selecionar"}
                      <CalendarDays
                        size={15}
                        className="shrink-0 text-[var(--muted)]"
                        aria-hidden="true"
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="polia-v3 w-auto rounded-xl border border-[var(--line)] bg-white p-0 shadow-lg"
                    style={TOKEN_BRIDGE_V3}
                  >
                    <Calendar
                      mode="single"
                      selected={dataDeIso(dInicio)}
                      onSelect={(d) => {
                        if (!d) return;
                        setDInicio(isoDeData(d));
                        setInicioAberto(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                  Fim (prazo) <span className="text-[var(--danger)]">*</span>
                </p>
                <Popover open={fimAberto} onOpenChange={setFimAberto}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-left text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
                    >
                      {dFim ? fmtDataCompleta(dFim) : "Selecionar"}
                      <CalendarDays
                        size={15}
                        className="shrink-0 text-[var(--muted)]"
                        aria-hidden="true"
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="polia-v3 w-auto rounded-xl border border-[var(--line)] bg-white p-0 shadow-lg"
                    style={TOKEN_BRIDGE_V3}
                  >
                    <Calendar
                      mode="single"
                      selected={dataDeIso(dFim)}
                      onSelect={(d) => {
                        if (!d) return;
                        setDFim(isoDeData(d));
                        setFimAberto(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                  Horário
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dHorario}
                  onChange={(e) => setDHorario(e.target.value)}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(v)) setDHorario("");
                  }}
                  maxLength={5}
                  placeholder="14:00"
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
                />
              </div>
              <div className="flex-1">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                  Horas por dia
                </p>
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={dHpd}
                  onChange={(e) => setDHpd(e.target.value)}
                  placeholder="Ex: 2"
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                Vinculado à meta
              </p>
              <Select
                value={dMetaId || "none"}
                onValueChange={(v) => setDMetaId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)] focus:ring-0">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent
                  className="polia-v3 rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)]"
                  style={TOKEN_BRIDGE_V3}
                >
                  <SelectItem value="none" className="text-[14px]">
                    Nenhuma
                  </SelectItem>
                  {metas.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-[14px]">
                      {m.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                Anotações rápidas
              </p>
              <textarea
                value={dNota}
                onChange={(e) => setDNota(e.target.value)}
                rows={3}
                placeholder="Notas soltas durante a execução"
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
              />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                Coluna
              </p>
              <Select value={dColuna} onValueChange={(v) => setDColuna(v as ColId)}>
                <SelectTrigger className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)] focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="polia-v3 rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)]"
                  style={TOKEN_BRIDGE_V3}
                >
                  {COLUNAS_BASE.map((col) => (
                    <SelectItem key={col.id} value={col.id} className="text-[14px]">
                      {nomeColuna(col.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={fecharDetalhe}
                className="rounded-lg bg-[var(--secondary)] px-4 py-2 text-[14px] font-medium text-[var(--secondary-ink)] transition-colors hover:opacity-90"
              >
                Salvar e fechar
              </button>
              <button
                type="button"
                onClick={excluirDoDetalhe}
                className="rounded-md px-2 py-2 text-[13px] text-[var(--danger)] hover:underline"
              >
                {delArmado ? "Excluir mesmo? Clique de novo" : "Excluir cartão"}
              </button>
            </div>
          </>
        )}
      </aside>

      <AlertDialog open={!!confirmarId} onOpenChange={(open) => !open && setConfirmarId(null)}>
        <AlertDialogContent
          className="polia-v3 rounded-xl border border-[var(--line)] bg-white"
          style={TOKEN_BRIDGE_V3}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--ink)]">
              Concluir esta tarefa?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--ink-soft)]">
              {cardConfirmando ? `"${cardConfirmando.titulo}" vai pra coluna Pronto.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:bg-[var(--surface)]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmarId) concluirComTransicao(confirmarId);
                setConfirmarId(null);
              }}
              className="rounded-lg bg-[var(--secondary)] text-[var(--secondary-ink)] hover:opacity-90"
            >
              Concluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
