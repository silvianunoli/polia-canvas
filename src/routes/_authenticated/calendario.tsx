import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { ChevronLeft, ChevronRight, ExternalLink, Link2, Unlink, Plus } from "lucide-react";
import { toastErro, toastSucesso } from "@/lib/toast";
import { BlockError } from "@/components/ui/BlockError";
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
  statusConexaoGoogle,
  iniciarConexaoGoogle,
  finalizarConexaoGoogle,
  listarEventosDoMes,
  desconectarGoogle,
} from "@/lib/calendarGoogle.functions";
import type { EventoGoogle } from "@/lib/googleCalendarApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TOKEN_BRIDGE_V3 } from "@/lib/uiTokenBridge";

interface CalendarioSearch {
  code?: string;
  state?: string;
}

export const Route = createFileRoute("/_authenticated/calendario")({
  validateSearch: (search: Record<string, unknown>): CalendarioSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Calendário · Pólia" },
      {
        name: "description",
        content:
          "Suas tarefas do Planner e, se conectar, os compromissos do Google Calendar, num só lugar.",
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
  horario: string | null;
}

type ItemDia =
  | {
      fonte: "planner";
      id: string;
      titulo: string;
      horario: string | null;
      href: string;
      concluido: boolean;
    }
  | { fonte: "google"; id: string; titulo: string; horario: string | null; href: string | null };

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function CalendarioPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [mostrarPlanner, setMostrarPlanner] = useState(true);
  const [mostrarGoogle, setMostrarGoogle] = useState(true);
  const [quadroFiltro, setQuadroFiltro] = useState<string>("todos");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [processandoCallback, setProcessandoCallback] = useState(false);
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

  const quadrosQuery = useQuery({
    queryKey: ["quadros-calendario", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quadros")
        .select("id, nome, slug")
        .eq("user_id", userId!);
      return (data ?? []) as Quadro[];
    },
  });
  const quadros = quadrosQuery.data ?? [];
  const quadrosPorId = useMemo(() => new Map(quadros.map((q) => [q.id, q])), [quadros]);

  const tarefasQuery = useQuery({
    queryKey: ["calendario-tarefas", userId, inicioISO, fimISO],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, status, quadro_id, prazo, horario")
        .eq("user_id", userId!)
        .not("quadro_id", "is", null)
        .not("prazo", "is", null)
        .gte("prazo", inicioISO)
        .lte("prazo", fimISO);
      return (data ?? []) as unknown as TarefaCal[];
    },
  });
  const tarefas = tarefasQuery.data ?? [];

  const statusGoogleQuery = useQuery({
    queryKey: ["google-status", userId],
    enabled: !!userId,
    queryFn: () => statusConexaoGoogle(),
  });
  const conectado = statusGoogleQuery.data?.conectado ?? false;
  const emailConectado = statusGoogleQuery.data?.email ?? null;

  const eventosGoogleQuery = useQuery({
    queryKey: ["google-eventos", userId, inicioISO, fimISO],
    enabled: !!userId && conectado && mostrarGoogle,
    queryFn: () =>
      listarEventosDoMes({
        data: {
          inicioISO: inicioGrade.toISOString(),
          fimISO: new Date(fimGrade.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
  });
  const eventosGoogle = useMemo(
    () => eventosGoogleQuery.data?.eventos ?? [],
    [eventosGoogleQuery.data],
  );

  const conectarMutation = useMutation({
    mutationFn: () => iniciarConexaoGoogle(),
    onSuccess: (res) => {
      if (res.error || !res.url) {
        toastErro(res.error ?? "Não consegui conectar com o Google agora.");
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro("Não consegui iniciar a conexão com o Google."),
  });

  const desconectarMutation = useMutation({
    mutationFn: () => desconectarGoogle(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-status", userId] });
      qc.invalidateQueries({ queryKey: ["google-eventos"] });
      toastSucesso("Google Calendar desconectado.");
    },
    onError: () => toastErro("Não consegui desconectar agora."),
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
    onError: () => toastErro("Não consegui criar a tarefa. Tenta de novo."),
  });

  const abrirComposer = () => {
    setNovoTitulo("");
    setNovoQuadroId(quadros[0]?.id ?? "");
    setMostrarComposer(true);
  };

  // Google redireciona de volta pra cá com ?code&state — troca por tokens e
  // limpa a URL. Só roda uma vez por code recebido.
  useEffect(() => {
    if (!search.code || !search.state || processandoCallback) return;
    setProcessandoCallback(true);
    finalizarConexaoGoogle({ data: { code: search.code, state: search.state } })
      .then((res) => {
        if (res.ok) toastSucesso("Google Calendar conectado.");
        else toastErro(res.error ?? "Não consegui confirmar a conexão com o Google.");
        qc.invalidateQueries({ queryKey: ["google-status", userId] });
      })
      .catch(() => toastErro("Não consegui confirmar a conexão com o Google."))
      .finally(() => {
        setProcessandoCallback(false);
        navigate({ to: "/calendario", search: {}, replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code, search.state]);

  const tarefasPorDia = useMemo(() => {
    const m = new Map<string, TarefaCal[]>();
    if (!mostrarPlanner) return m;
    for (const t of tarefas) {
      if (quadroFiltro !== "todos" && t.quadro_id !== quadroFiltro) continue;
      const lista = m.get(t.prazo) ?? [];
      lista.push(t);
      m.set(t.prazo, lista);
    }
    return m;
  }, [tarefas, mostrarPlanner, quadroFiltro]);

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, EventoGoogle[]>();
    if (!mostrarGoogle) return m;
    for (const ev of eventosGoogle) {
      const dia = ev.inicio.slice(0, 10);
      const lista = m.get(dia) ?? [];
      lista.push(ev);
      m.set(dia, lista);
    }
    return m;
  }, [eventosGoogle, mostrarGoogle]);

  useEffect(() => {
    setMostrarComposer(false);
  }, [diaSelecionado]);

  const linkQuadro = (quadroId: string) => {
    const q = quadrosPorId.get(quadroId);
    return q ? `/planner/${q.slug}` : "/planner";
  };

  const itensDoDia = (iso: string): ItemDia[] => {
    const t: ItemDia[] = (tarefasPorDia.get(iso) ?? []).map((x) => ({
      fonte: "planner",
      id: x.id,
      titulo: x.titulo,
      horario: x.horario,
      href: linkQuadro(x.quadro_id),
      concluido: x.status === "concluido",
    }));
    const g: ItemDia[] = (eventosPorDia.get(iso) ?? []).map((x) => ({
      fonte: "google",
      id: x.id,
      titulo: x.titulo,
      horario: x.diaTodo ? null : format(new Date(x.inicio), "HH:mm"),
      href: x.link,
    }));
    return [...t, ...g].sort((a, b) => (a.horario ?? "").localeCompare(b.horario ?? ""));
  };

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <section className="mx-auto max-w-[1120px] px-6 py-8 md:px-10">
        <h1 className="font-fraunces mb-1 text-[clamp(28px,5vw,36px)] leading-tight text-[var(--ink)]">
          Calendário
        </h1>
        <p className="mb-6 text-[14px] text-[var(--ink-soft)]">
          Suas tarefas do Planner{conectado ? " e os compromissos do seu Google Calendar" : ""}, num
          só lugar.
        </p>

        {/* Navegação de mês */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMes((m) => subMonths(m, 1))}
              aria-label="Mês anterior"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <p className="font-fraunces w-[150px] text-center text-[18px] text-[var(--ink)] sm:w-[190px]">
              {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <button
              type="button"
              onClick={() => setMes((m) => addMonths(m, 1))}
              aria-label="Próximo mês"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMes(startOfMonth(new Date()))}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
          >
            Hoje
          </button>
        </div>

        {/* Filtros */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarPlanner((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
              mostrarPlanner
                ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            Planner
          </button>
          <button
            type="button"
            onClick={() => conectado && setMostrarGoogle((v) => !v)}
            disabled={!conectado}
            title={!conectado ? "Conecte o Google Calendar pra filtrar por ele" : undefined}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
              !conectado
                ? "cursor-not-allowed border-[var(--line)] text-[var(--muted)] opacity-50"
                : mostrarGoogle
                  ? "border-[var(--ink-soft)] bg-[var(--surface)] text-[var(--ink)]"
                  : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            Google Calendar
          </button>

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

          <div className="ml-auto">
            {conectado ? (
              <button
                type="button"
                onClick={() => desconectarMutation.mutate()}
                disabled={desconectarMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--muted)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)]"
              >
                <Unlink size={14} aria-hidden="true" />
                {emailConectado ?? "conectado"} · desconectar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => conectarMutation.mutate()}
                disabled={conectarMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--secondary-ink)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Link2 size={14} aria-hidden="true" />
                {conectarMutation.isPending ? "Abrindo..." : "Conectar Google Calendar"}
              </button>
            )}
          </div>
        </div>

        {mostrarGoogle && eventosGoogleQuery.data?.error && (
          <div className="mb-5">
            <BlockError
              message="Não deu pra carregar os compromissos do Google Calendar."
              onRetry={() => eventosGoogleQuery.refetch()}
            />
          </div>
        )}

        {/* Grade mensal */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {DIAS_SEMANA.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {dias.map((dia) => {
            const iso = format(dia, "yyyy-MM-dd");
            const itens = itensDoDia(iso);
            const foraDoMes = !isSameMonth(dia, mes);
            const hoje = isToday(dia);
            const selecionado = diaSelecionado === iso;
            return (
              <button
                type="button"
                key={iso}
                onClick={() => setDiaSelecionado(selecionado ? null : iso)}
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
                          item.fonte === "google"
                            ? "bg-[var(--muted)]"
                            : item.concluido
                              ? "bg-[var(--line)]"
                              : "bg-[var(--secondary)]"
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
                        item.fonte === "google"
                          ? "bg-[var(--surface)] text-[var(--ink-soft)]"
                          : item.concluido
                            ? "bg-[var(--surface)] text-[var(--muted)] line-through"
                            : "bg-white text-[var(--ink-soft)] outline outline-1 outline-[var(--secondary)]"
                      }`}
                    >
                      {item.titulo}
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

        {/* Detalhe do dia selecionado — sidesheet, não exige scroll da página */}
        <Sheet open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
          <SheetContent
            side="right"
            className="polia-v3 flex w-full flex-col gap-0 overflow-y-auto border-l border-[var(--line)] bg-white p-5 sm:max-w-md"
            style={TOKEN_BRIDGE_V3}
          >
            <SheetHeader className="mb-3 text-left">
              <SheetTitle className="font-fraunces text-[18px] font-normal text-[var(--ink)]">
                {diaSelecionado
                  ? format(parseISO(diaSelecionado), "EEEE, d 'de' MMMM", { locale: ptBR })
                  : ""}
              </SheetTitle>
            </SheetHeader>

            {diaSelecionado && (
              <>
                {quadros.length === 0 ? (
                  <p className="mb-4 text-[13px] italic text-[var(--muted)]">
                    Crie um quadro no{" "}
                    <a href="/planner" className="text-[var(--secondary-text)] hover:underline">
                      Planner
                    </a>{" "}
                    antes de adicionar tarefas por aqui.
                  </p>
                ) : mostrarComposer ? (
                  <div className="mb-4 flex flex-col gap-2 rounded-lg border border-[var(--line)] p-3">
                    <input
                      autoFocus
                      value={novoTitulo}
                      onChange={(e) => setNovoTitulo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setMostrarComposer(false);
                      }}
                      placeholder="Nome da tarefa"
                      maxLength={200}
                      className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
                    />
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
                        className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] text-[var(--ink-soft)] hover:bg-[var(--surface)]"
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
                        className="rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-[13px] font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-60"
                      >
                        {criarTarefaMutation.isPending ? "Adicionando..." : "Adicionar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={abrirComposer}
                    className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--secondary-text)] hover:underline"
                  >
                    <Plus size={14} aria-hidden="true" /> Nova tarefa nesse dia
                  </button>
                )}

                {itensDoDia(diaSelecionado).length === 0 ? (
                  <p className="text-[14px] italic text-[var(--muted)]">
                    nada marcado pra esse dia.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {itensDoDia(diaSelecionado).map((item) => (
                      <li
                        key={`${item.fonte}-${item.id}`}
                        className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            item.fonte === "google"
                              ? "bg-[var(--highlight)]"
                              : "bg-[var(--secondary)]"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate text-[14px] text-[var(--ink-soft)]">
                          {item.titulo}
                        </span>
                        {item.horario && (
                          <span className="shrink-0 text-[12px] text-[var(--muted)]">
                            {item.horario}
                          </span>
                        )}
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                          {item.fonte === "google" ? "Google" : "Planner"}
                        </span>
                        {item.href && (
                          <a
                            href={item.href}
                            target={item.fonte === "google" ? "_blank" : undefined}
                            rel={item.fonte === "google" ? "noreferrer" : undefined}
                            className="shrink-0 text-[var(--secondary-text)]"
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
      </section>
    </div>
  );
}
