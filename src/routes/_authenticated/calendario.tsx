import { useEffect, useMemo, useState } from "react";
import { MSG_LIMITE_CARTOES } from "@/lib/planos";
import { createFileRoute } from "@tanstack/react-router";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import { Vazio } from "@/components/layout/Vazio";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  parseISO,
  isSameMonth,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { hojeISO } from "@/lib/data.functions";
import { ddmm, distribuirTarefasPorDia, type OcorrenciaTarefa } from "@/lib/calendarioTarefas";
import { useFerramentasInternas } from "@/hooks/useFerramentasInternas";
import { usePedidosDoPeriodo, type PedidoLinha } from "@/components/pedidos/dados";
import { estaAtrasado } from "@/lib/pedidos";

// A integração com o Google Calendar saiu da Pólia One em 02/11/2026 (decisão
// da Sil): o Calendário mostra as entregas dos pedidos (e o Planner, na conta
// interna). A tabela google_calendar_conexoes ficou no banco.
export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário · Pólia One" },
      {
        name: "description",
        content: "As entregas dos pedidos, o mês inteiro numa tela só.",
      },
    ],
  }),
  component: CalendarioPage,
});

interface Quadro {
  id: string;
  nome: string;
  slug: string;
}

interface TarefaCal {
  id: string;
  titulo: string;
  status: string;
  quadro_id: string;
  prazo: string;
  data_inicio: string | null;
  horario: string | null;
}

// "pedido" = entrega do quadro de Pedidos (28/10/2026): é a fonte principal
// desde que o Planner ficou só pra conta interna (lib/ferramentasInternas).
type ItemDia = {
  fonte: "planner" | "pedido";
  id: string;
  titulo: string;
  horario: string | null;
  href: string;
  concluido: boolean;
  /** "até 20/10" no começo do intervalo; "em andamento, até 20/10" no meio. */
  detalhe: string | null;
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function CalendarioPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  // Planner só aparece pra conta interna; pra todas, a grade é das entregas.
  const comPlanner = useFerramentasInternas().planner;
  const [mostrarEntregas, setMostrarEntregas] = useState(true);
  const [mostrarPlannerFiltro, setMostrarPlanner] = useState(true);
  const mostrarPlanner = comPlanner && mostrarPlannerFiltro;
  const [quadroFiltro, setQuadroFiltro] = useState<string>("todos");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [mostrarComposer, setMostrarComposer] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoQuadroId, setNovoQuadroId] = useState("");

  const inicioGrade = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 });
  const fimGrade = endOfWeek(endOfMonth(mes), { weekStartsOn: 0 });
  const dias = useMemo(
    () => eachDayOfInterval({ start: inicioGrade, end: fimGrade }),
    [inicioGrade, fimGrade],
  );
  const inicioISO = format(inicioGrade, "yyyy-MM-dd");
  const fimISO = format(fimGrade, "yyyy-MM-dd");

  const pedidosQuery = usePedidosDoPeriodo(userId, inicioISO, fimISO, mostrarEntregas);

  const quadrosQuery = useQuery({
    queryKey: ["quadros-calendario", userId],
    enabled: !!userId && comPlanner,
    queryFn: async () => {
      const { data } = await supabase
        .from("quadros")
        .select("id, nome, slug")
        .eq("user_id", userId!);
      return (data ?? []) as Quadro[];
    },
  });
  const quadros = useMemo(() => quadrosQuery.data ?? [], [quadrosQuery.data]);
  const quadrosPorId = useMemo(() => new Map(quadros.map((q) => [q.id, q])), [quadros]);

  const tarefasQuery = useQuery({
    queryKey: ["calendario-tarefas", userId, inicioISO, fimISO],
    enabled: !!userId && comPlanner,
    queryFn: async () => {
      // QA-34 (07/10/2026): a tarefa entra se o intervalo [data_inicio, prazo]
      // encosta na grade, não só se o prazo cai nela. prazo >= início da grade E
      // (prazo <= fim OU data_inicio <= fim). Sem data_inicio, o segundo termo é
      // nulo e vale só o prazo, como antes.
      const { data, error } = await supabase
        .from("tarefas")
        .select("id, titulo, status, quadro_id, prazo, data_inicio, horario")
        .eq("user_id", userId!)
        .not("quadro_id", "is", null)
        .not("prazo", "is", null)
        .gte("prazo", inicioISO)
        .or(`prazo.lte.${fimISO},data_inicio.lte.${fimISO}`);
      // Falha na leitura não pode virar "Nada marcado neste mês".
      if (error) throw error;
      return (data ?? []) as unknown as TarefaCal[];
    },
  });

  const criarTarefaMutation = useMutation({
    mutationFn: async ({
      quadroId,
      titulo,
      dia,
    }: {
      quadroId: string;
      titulo: string;
      dia: string;
    }) => {
      const { error } = await supabase.from("tarefas").insert({
        user_id: userId,
        quadro_id: quadroId,
        titulo,
        status: "ideias",
        fonte: "manual",
        data_inicio: dia,
        prazo: dia,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendario-tarefas"] });
      setMostrarComposer(false);
      setNovoTitulo("");
      toastSucesso("Tarefa criada.");
    },
    // Limite de 100 cartões do Grátis (assert_cota_cartoes) vem como erro do banco.
    onError: (e) =>
      toastErro(
        /limite do plano Grátis/i.test((e as { message?: string } | null)?.message ?? "")
          ? MSG_LIMITE_CARTOES
          : "A Pólia One não conseguiu criar a tarefa. Tenta de novo.",
      ),
  });

  const abrirComposer = () => {
    setNovoTitulo("");
    setNovoQuadroId(quadros[0]?.id ?? "");
    setMostrarComposer(true);
  };

  // Cada dia guarda as tarefas com o papel delas ali (início, andamento, prazo).
  // A grade mostra só início e prazo; o detalhe do dia mostra todas.
  const tarefasPorDia = useMemo(() => {
    if (!mostrarPlanner) return new Map<string, OcorrenciaTarefa<TarefaCal>[]>();
    const filtradas = (tarefasQuery.data ?? []).filter(
      (t) => quadroFiltro === "todos" || t.quadro_id === quadroFiltro,
    );
    return distribuirTarefasPorDia(filtradas, inicioISO, fimISO);
  }, [tarefasQuery.data, mostrarPlanner, quadroFiltro, inicioISO, fimISO]);

  const entregasPorDia = useMemo(() => {
    const m = new Map<string, PedidoLinha[]>();
    if (!mostrarEntregas) return m;
    for (const p of pedidosQuery.data ?? []) {
      const lista = m.get(p.entregaEm) ?? [];
      lista.push(p);
      m.set(p.entregaEm, lista);
    }
    return m;
  }, [pedidosQuery.data, mostrarEntregas]);

  useEffect(() => {
    setMostrarComposer(false);
  }, [diaSelecionado]);

  const linkQuadro = (quadroId: string) => {
    const q = quadrosPorId.get(quadroId);
    return q ? `/planner/${q.slug}` : "/planner";
  };

  const itensDoDia = (iso: string, { comAndamento }: { comAndamento: boolean }): ItemDia[] => {
    const t: ItemDia[] = (tarefasPorDia.get(iso) ?? [])
      .filter((o) => comAndamento || o.papel !== "andamento")
      .map(({ tarefa: x, papel }) => ({
        fonte: "planner",
        id: x.id,
        titulo: x.titulo,
        horario: x.horario,
        href: linkQuadro(x.quadro_id),
        concluido: x.status === "concluido",
        detalhe:
          papel === "inicio"
            ? `até ${ddmm(x.prazo)}`
            : papel === "andamento"
              ? `em andamento, até ${ddmm(x.prazo)}`
              : null,
      }));
    const p: ItemDia[] = (entregasPorDia.get(iso) ?? []).map((x) => ({
      fonte: "pedido",
      id: x.id,
      titulo: `Entrega · ${x.clienteNome || "sem nome"}`,
      horario: null,
      href: "/pedidos",
      concluido: x.andamento === "entregue",
      detalhe: estaAtrasado(x, hojeISO())
        ? "atrasado"
        : x.itens.map((i) => `${i.quantidade}x ${i.produtoNome}`).join(", "),
    }));
    return [...p, ...t].sort((a, b) => (a.horario ?? "").localeCompare(b.horario ?? ""));
  };

  // Mês sem nenhum item desenhava 35 células em branco e mais nada: nem aviso de
  // carregamento, nem uma saída. A grade fica (ela é a própria navegação), mas
  // ganha embaixo o estado vazio canônico.
  const totalNaGrade = useMemo(() => {
    // Tarefa com intervalo aparece em vários dias: conta uma vez só.
    const idsTarefas = new Set<string>();
    for (const lista of tarefasPorDia.values()) for (const o of lista) idsTarefas.add(o.tarefa.id);
    let n = idsTarefas.size;
    for (const lista of entregasPorDia.values()) n += lista.length;
    return n;
  }, [tarefasPorDia, entregasPorDia]);
  const carregandoGrade =
    (mostrarPlanner && tarefasQuery.isLoading) || (mostrarEntregas && pedidosQuery.isLoading);
  const textoVazioDoMes = !mostrarEntregas
    ? 'O filtro "Entregas" está desligado. Liga ele aí em cima que as entregas voltam pra grade.'
    : "O calendário mostra o dia de entrega de cada pedido. Nenhum cai neste mês.";
  const itensDiaSelecionado = diaSelecionado
    ? itensDoDia(diaSelecionado, { comAndamento: true })
    : [];
  const erroTarefas =
    (mostrarPlanner && tarefasQuery.isError) || (mostrarEntregas && pedidosQuery.isError);

  return (
    <PaginaLogada
      dica="calendario"
      largura="larga"
      eyebrow="Calendário"
      titulo="O mês inteiro à vista."
      subtitulo="As entregas dos pedidos, num só lugar."
    >
      <div>
        {/* Navegação de mês */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMes((m) => subMonths(m, 1))}
              aria-label="Mês anterior"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <p className="w-[150px] text-center text-[18px] text-[var(--ink)] sm:w-[190px]">
              {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <button
              type="button"
              onClick={() => setMes((m) => addMonths(m, 1))}
              aria-label="Próximo mês"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMes(startOfMonth(new Date()))}
            className={BTN_MIUDO}
          >
            Hoje
          </button>
        </div>

        {/* Filtros */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarEntregas((v) => !v)}
            aria-pressed={mostrarEntregas}
            className={`${BTN_MIUDO} ${mostrarEntregas ? "!bg-[var(--secondary)]" : "bg-white"}`}
          >
            Entregas
          </button>
          {comPlanner && (
            <button
              type="button"
              onClick={() => setMostrarPlanner((v) => !v)}
              aria-pressed={mostrarPlanner}
              className={`${BTN_MIUDO} ${mostrarPlanner ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              Planner
            </button>
          )}
          {mostrarPlanner && quadros.length > 1 && (
            <Select value={quadroFiltro} onValueChange={setQuadroFiltro}>
              <SelectTrigger className="h-9 w-[190px] rounded-lg border border-[var(--line)] px-3 text-[13px] text-[var(--ink-soft)] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="polia-v3 rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)]"
                style={TOKEN_BRIDGE_V3}
              >
                <SelectItem value="todos" className="text-[13px]">
                  Todos os quadros
                </SelectItem>
                {quadros.map((q) => (
                  <SelectItem key={q.id} value={q.id} className="text-[13px]">
                    {q.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {erroTarefas && (
          <div className="mb-5">
            <Vazio
              icone={AlertTriangle}
              titulo="A Pólia One não conseguiu carregar o que cai neste mês."
              texto="Pode ter sido a conexão. Os pedidos continuam guardados, a grade só não conseguiu ler agora."
              acao={
                <button
                  type="button"
                  onClick={() => {
                    void pedidosQuery.refetch();
                    if (comPlanner) void tarefasQuery.refetch();
                  }}
                  disabled={tarefasQuery.isFetching || pedidosQuery.isFetching}
                  className={BTN_ACAO}
                >
                  {tarefasQuery.isFetching || pedidosQuery.isFetching
                    ? "Tentando…"
                    : "Tentar de novo"}
                </button>
              }
            />
          </div>
        )}

        {/* Grade mensal */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-accent font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
          {DIAS_SEMANA.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {dias.map((dia) => {
            const iso = format(dia, "yyyy-MM-dd");
            const itens = itensDoDia(iso, { comAndamento: false });
            const foraDoMes = !isSameMonth(dia, mes);
            const hoje = isToday(dia);
            const selecionado = diaSelecionado === iso;
            const numeroDia = format(dia, "d");
            const rotuloDia =
              itens.length > 0
                ? `${numeroDia}, ${itens.length} ${itens.length === 1 ? "item" : "itens"}`
                : numeroDia;
            return (
              <button
                type="button"
                key={iso}
                onClick={() => setDiaSelecionado(selecionado ? null : iso)}
                aria-label={rotuloDia}
                className={`flex min-h-[60px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-[100px] ${
                  selecionado
                    ? "border-[var(--secondary)] bg-[var(--secondary-light)]"
                    : "border-[var(--line)]"
                } ${foraDoMes && !selecionado ? "bg-[var(--bg)]" : !selecionado ? "bg-white" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] ${
                    hoje
                      ? "bg-[var(--ink)] font-semibold text-white"
                      : foraDoMes
                        ? "text-[var(--muted)]"
                        : "text-[var(--ink-soft)]"
                  }`}
                >
                  {format(dia, "d")}
                </span>

                {/* Mobile: dots resumidos — chip com texto não cabe numa célula de ~42px */}
                {itens.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 sm:hidden">
                    {itens.slice(0, 4).map((item) => (
                      <span
                        key={`${item.fonte}-${item.id}`}
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          item.concluido ? "bg-[var(--line)]" : "bg-[var(--secondary)]"
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                    {itens.length > 4 && (
                      <span className="text-[9px] text-[var(--muted)]">+{itens.length - 4}</span>
                    )}
                  </div>
                )}

                {/* sm+: chips com texto, célula tem espaço de sobra */}
                <div className="hidden flex-1 flex-col gap-1 sm:flex">
                  {itens.slice(0, 3).map((item) => (
                    <span
                      key={`${item.fonte}-${item.id}`}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] ${
                        item.concluido
                          ? "bg-[var(--surface)] text-[var(--muted)] line-through"
                          : "bg-white text-[var(--ink-soft)] outline outline-1 outline-[var(--secondary)]"
                      }`}
                    >
                      {item.titulo}
                      {item.detalhe ? ` · ${item.detalhe}` : ""}
                    </span>
                  ))}
                  {itens.length > 3 && (
                    <span className="text-[11px] text-[var(--muted)]">
                      +{itens.length - 3} mais
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {carregandoGrade ? (
          <div className="mt-4 h-28 animate-pulse rounded-xl bg-[var(--surface)]" />
        ) : erroTarefas ? null : totalNaGrade === 0 ? (
          <div className="mt-4">
            <Vazio
              icone={CalendarDays}
              titulo={mostrarEntregas ? "Nada marcado neste mês." : "Nada aparecendo neste mês."}
              texto={textoVazioDoMes}
              acao={
                mostrarEntregas ? (
                  <LinkInterno href="/pedidos" className={BTN_ACAO}>
                    Quero anotar um pedido
                    <span aria-hidden="true">→</span>
                  </LinkInterno>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {/* Detalhe do dia selecionado — sidesheet, não exige scroll da página */}
        <Sheet open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
          <SheetContent
            side="right"
            className="polia-v3 flex w-full flex-col gap-0 overflow-y-auto border-l border-[var(--line)] bg-white p-5 sm:max-w-md"
            style={TOKEN_BRIDGE_V3}
          >
            <SheetHeader className="mb-3 text-left">
              <SheetTitle className="text-[18px] font-normal text-[var(--ink)]">
                {diaSelecionado
                  ? format(parseISO(diaSelecionado), "EEEE, d 'de' MMMM", { locale: ptBR })
                  : ""}
              </SheetTitle>
            </SheetHeader>

            {diaSelecionado && (
              <>
                {!comPlanner ? (
                  <LinkInterno
                    href="/pedidos"
                    className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--secondary-text)] hover:underline"
                  >
                    <Plus size={14} aria-hidden="true" /> Anotar um pedido
                  </LinkInterno>
                ) : quadros.length === 0 ? (
                  <p className="mb-4 text-[13px] italic text-[var(--muted)]">
                    Crie um quadro no{" "}
                    <LinkInterno
                      href="/planner"
                      className="text-[var(--secondary-text)] hover:underline"
                    >
                      Planner
                    </LinkInterno>{" "}
                    antes de adicionar tarefas por aqui.
                  </p>
                ) : mostrarComposer ? (
                  <div className="mb-4 flex flex-col gap-2 rounded-lg border border-[var(--line)] p-3">
                    <Campo label="Nome da tarefa">
                      <input
                        autoFocus
                        value={novoTitulo}
                        onChange={(e) => setNovoTitulo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setMostrarComposer(false);
                        }}
                        placeholder="Nome da tarefa"
                        maxLength={200}
                        className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary-text)]"
                      />
                    </Campo>
                    <Select value={novoQuadroId} onValueChange={setNovoQuadroId}>
                      <SelectTrigger className="h-9 w-full rounded-lg border border-[var(--line)] px-3 text-[13px] text-[var(--ink-soft)] focus:ring-0">
                        <SelectValue placeholder="Escolher quadro" />
                      </SelectTrigger>
                      <SelectContent
                        className="polia-v3 rounded-lg border border-[var(--line)] bg-white text-[var(--ink-soft)]"
                        style={TOKEN_BRIDGE_V3}
                      >
                        {quadros.map((q) => (
                          <SelectItem key={q.id} value={q.id} className="text-[13px]">
                            {q.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setMostrarComposer(false)}
                        className={BTN_ACAO_CONTORNO}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={
                          !novoTitulo.trim() || !novoQuadroId || criarTarefaMutation.isPending
                        }
                        onClick={() =>
                          criarTarefaMutation.mutate({
                            quadroId: novoQuadroId,
                            titulo: novoTitulo.trim(),
                            dia: diaSelecionado,
                          })
                        }
                        className={BTN_ACAO}
                      >
                        {criarTarefaMutation.isPending ? "Adicionando..." : "Adicionar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={abrirComposer}
                    className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--secondary-text)] hover:underline"
                  >
                    <Plus size={14} aria-hidden="true" /> Nova tarefa nesse dia
                  </button>
                )}

                {erroTarefas ? (
                  <div role="alert" className="rounded-lg border border-[var(--line)] p-3">
                    <p className="text-[13px] text-[var(--ink-soft)]">
                      A Pólia One não conseguiu carregar o que cai nesse dia.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void pedidosQuery.refetch();
                        if (comPlanner) void tarefasQuery.refetch();
                      }}
                      disabled={tarefasQuery.isFetching || pedidosQuery.isFetching}
                      className={`${BTN_MIUDO} mt-2 min-h-11`}
                    >
                      {tarefasQuery.isFetching || pedidosQuery.isFetching
                        ? "Tentando…"
                        : "Tentar de novo"}
                    </button>
                  </div>
                ) : itensDiaSelecionado.length === 0 ? (
                  <Vazio
                    denso
                    titulo="Nada marcado nesse dia."
                    texto="Nenhuma entrega cai nesse dia."
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {itensDiaSelecionado.map((item) => (
                      <li
                        key={`${item.fonte}-${item.id}`}
                        className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[var(--secondary)]"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] text-[var(--ink-soft)]">
                            {item.titulo}
                          </span>
                          {item.detalhe && (
                            <span className="block truncate text-[12px] text-[var(--muted)]">
                              {item.detalhe}
                            </span>
                          )}
                        </span>
                        {item.horario && (
                          <span className="shrink-0 text-[12px] text-[var(--muted)]">
                            {item.horario}
                          </span>
                        )}
                        <span className="shrink-0 text-[10px] font-accent font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                          {item.fonte === "pedido" ? "Entrega" : "Planner"}
                        </span>
                        {item.href && (
                          <a
                            href={item.href}
                            className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--secondary-text)]"
                            aria-label="Abrir"
                          >
                            <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </PaginaLogada>
  );
}
