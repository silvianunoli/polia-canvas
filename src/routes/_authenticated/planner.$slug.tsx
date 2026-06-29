import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { ArrowLeft, ArrowRight, Plus, Trash2, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/planner/$slug")({
  head: () => ({
    meta: [{ title: "Quadro · Pólia" }],
  }),
  component: PlannerBoard,
});

const COLUNAS = [
  { id: "ideias", label: "Ideias & pendências", cor: "#1A1A2E", bg: "rgba(26,26,46,0.05)" },
  { id: "planejado", label: "Planejado", cor: "#6B50CC", bg: "rgba(107,80,204,0.07)" },
  { id: "hoje", label: "Hoje", cor: "#C96B3E", bg: "rgba(201,107,62,0.07)" },
  { id: "em_progresso", label: "Em progresso", cor: "#1A7FAD", bg: "rgba(26,127,173,0.07)" },
  { id: "pausado", label: "Pausado", cor: "#B8862E", bg: "rgba(184,134,46,0.08)" },
  { id: "concluido", label: "Concluído", cor: "#2D6A4F", bg: "rgba(45,106,79,0.08)" },
] as const;

type ColId = (typeof COLUNAS)[number]["id"];
const COL_IDS = COLUNAS.map((c) => c.id) as string[];

const PROXIMA: Record<ColId, ColId> = {
  ideias: "planejado",
  planejado: "hoje",
  hoje: "em_progresso",
  em_progresso: "concluido",
  pausado: "em_progresso",
  concluido: "concluido",
};

const PRIORIDADES = [
  { v: "baixa", label: "Baixa", cor: "#2D6A4F" },
  { v: "media", label: "Média", cor: "#B8862E" },
  { v: "alta", label: "Alta", cor: "#C9407A" },
];
const corPrioridade = (v: string | null) =>
  PRIORIDADES.find((p) => p.v === v)?.cor ?? "rgba(26,26,46,0.25)";
const proxPrioridade = (v: string | null) => {
  const i = PRIORIDADES.findIndex((p) => p.v === v);
  return PRIORIDADES[(i + 1) % PRIORIDADES.length].v;
};

interface Card {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string | null;
  prazo: string | null;
  assigned_to: string | null;
  created_at: string;
}

function formatarPrazo(prazo: string): string {
  return new Date(prazo + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

function colunaDoCard(status: string): ColId {
  return (COL_IDS.includes(status) ? status : "ideias") as ColId;
}

function PlannerBoard() {
  const { slug } = Route.useParams();
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();

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

  const cardsQuery = useQuery({
    queryKey: ["quadro-tarefas", quadroId],
    enabled: !!quadroId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, descricao, status, prioridade, prazo, assigned_to, created_at")
        .eq("quadro_id", quadroId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as Card[];
    },
  });

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);
  const total = cards.length;
  const prontos = cards.filter((c) => colunaDoCard(c.status) === "concluido").length;

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

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [composerCol, setComposerCol] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaPrioridade, setNovaPrioridade] = useState("media");
  const [novoPrazo, setNovoPrazo] = useState("");

  const updateLocal = (mut: (l: Card[]) => Card[]) =>
    qc.setQueryData<Card[]>(["quadro-tarefas", quadroId], (old) => mut(old ?? []));
  const invalidar = () => qc.invalidateQueries({ queryKey: ["quadro-tarefas", quadroId] });

  const mover = async (id: string, status: ColId) => {
    updateLocal((l) => l.map((c) => (c.id === id ? { ...c, status } : c)));
    await supabase
      .from("tarefas")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const mudarPrioridade = async (id: string, prioridade: string) => {
    updateLocal((l) => l.map((c) => (c.id === id ? { ...c, prioridade } : c)));
    await supabase.from("tarefas").update({ prioridade }).eq("id", id);
  };

  const mudarPrazo = async (id: string, prazo: string) => {
    const valor = prazo || null;
    updateLocal((l) => l.map((c) => (c.id === id ? { ...c, prazo: valor } : c)));
    await supabase.from("tarefas").update({ prazo: valor }).eq("id", id);
  };

  const mudarAssignee = async (id: string, assignee: string) => {
    const valor = assignee || null;
    updateLocal((l) => l.map((c) => (c.id === id ? { ...c, assigned_to: valor } : c)));
    await supabase.from("tarefas").update({ assigned_to: valor }).eq("id", id);
  };

  const deletar = async (id: string) => {
    updateLocal((l) => l.filter((c) => c.id !== id));
    await supabase.from("tarefas").delete().eq("id", id);
  };

  const criar = async (status: string) => {
    const titulo = novoTitulo.trim();
    if (!titulo || !userId || !quadroId) return;
    setNovoTitulo("");
    setComposerCol(null);
    await supabase.from("tarefas").insert({
      user_id: userId,
      quadro_id: quadroId,
      titulo,
      status,
      fonte: "manual",
      prioridade: novaPrioridade,
      prazo: novoPrazo || null,
    });
    setNovoPrazo("");
    invalidar();
  };

  const apagarQuadro = async () => {
    if (!quadroId) return;
    if (!window.confirm("Apagar este quadro e todos os cartões dele? Não dá pra desfazer.")) return;
    await supabase.from("quadros").delete().eq("id", quadroId);
    qc.invalidateQueries({ queryKey: ["quadros", userId] });
    navigate({ to: "/planner" });
  };

  if (!quadroQuery.isLoading && !quadroQuery.data) {
    return (
      <div className="min-h-screen bg-[#FDF8F5]">
        <PainelNav navActive="/planner" />
        <main className="mx-auto max-w-[600px] px-6 py-20 text-center">
          <p className="mb-4 font-serif text-[24px] text-[#1A1A2E]">Quadro não encontrado</p>
          <a href="/planner" className="font-sans text-[14px] text-[#C96B3E] hover:underline">
            ← voltar aos quadros
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/planner" />

      <section className="px-6 pb-5 pt-8 md:px-10">
        <div className="mx-auto max-w-[1400px]">
          <a
            href="/planner"
            className="mb-3 inline-flex items-center gap-1.5 font-sans text-[13px] text-[#1A1A2E] opacity-50 hover:opacity-90"
          >
            <ArrowLeft size={15} /> Quadros
          </a>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-1 font-serif text-[34px] leading-tight text-[#1A1A2E] sm:text-[40px]">
                {quadroQuery.data?.nome ?? "Quadro"}
              </h1>
              <p className="caveat-decorativo text-[#C96B3E]">
                {total === 0
                  ? "nenhum cartão ainda — comece por uma ideia."
                  : `${total} ${total === 1 ? "cartão" : "cartões"} · ${prontos} ${prontos === 1 ? "pronto" : "prontos"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={apagarQuadro}
              aria-label="Apagar quadro"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#1A1A2E] opacity-30 transition-all hover:bg-[rgba(201,64,122,0.1)] hover:text-[#C9407A] hover:opacity-100"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* Kanban — 6 colunas com scroll horizontal */}
      <section className="overflow-x-auto px-6 pb-16 md:px-10">
        <div className="mx-auto flex min-w-max max-w-[1400px] gap-4">
          {COLUNAS.map((col) => {
            const lista = cards.filter((c) => colunaDoCard(c.status) === col.id);
            const ativa = overCol === col.id;
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
                className={`flex w-[280px] shrink-0 flex-col rounded-xl p-3 transition-colors ${
                  ativa
                    ? "border border-[rgba(201,107,62,0.4)] bg-[rgba(201,107,62,0.04)]"
                    : "border border-transparent"
                }`}
                style={!ativa ? { background: col.bg } : undefined}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-accent text-[11px] font-bold uppercase tracking-[1px]"
                      style={{ color: col.cor }}
                    >
                      {col.label}
                    </span>
                    <span className="rounded-full bg-[rgba(26,26,46,0.06)] px-2 py-0.5 font-sans text-[12px] text-[#1A1A2E] opacity-40">
                      {lista.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setComposerCol(col.id);
                      setNovoTitulo("");
                    }}
                    aria-label={`Adicionar cartão em ${col.label}`}
                    className="font-sans text-[20px] leading-none text-[#C96B3E] opacity-50 hover:opacity-100"
                  >
                    +
                  </button>
                </div>

                {composerCol === col.id && (
                  <div className="mb-3 rounded-xl border border-[rgba(26,26,46,0.1)] bg-white p-2.5">
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
                      placeholder="o que precisa ser feito?"
                      className="mb-2 w-full rounded-lg border border-[rgba(26,26,46,0.12)] px-2.5 py-2 font-sans text-[14px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:outline-none"
                    />
                    <div className="mb-2 flex gap-1.5">
                      {PRIORIDADES.map((p) => (
                        <button
                          key={p.v}
                          type="button"
                          onClick={() => setNovaPrioridade(p.v)}
                          className={`flex-1 rounded-md border py-1 font-sans text-[11px] transition-colors ${
                            novaPrioridade === p.v
                              ? "font-semibold text-white"
                              : "border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60"
                          }`}
                          style={
                            novaPrioridade === p.v
                              ? { background: p.cor, borderColor: p.cor }
                              : undefined
                          }
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={novoPrazo}
                        onChange={(e) => setNovoPrazo(e.target.value)}
                        className="flex-1 rounded-lg border border-[rgba(26,26,46,0.12)] px-2 py-1.5 font-sans text-[12px] text-[#1A1A2E] focus:border-[#C96B3E] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => criar(col.id)}
                        disabled={!novoTitulo.trim()}
                        className="rounded-lg bg-polia-terracota px-3 py-1.5 font-sans text-[12px] font-semibold text-polia-creme hover:bg-[#B85A2D] disabled:opacity-40"
                      >
                        Criar
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  {lista.length === 0 && composerCol !== col.id ? (
                    <div className="rounded-xl border-2 border-dashed border-[rgba(26,26,46,0.08)] p-5 text-center">
                      <p className="caveat-decorativo text-[#1A1A2E] opacity-30">nada por aqui.</p>
                    </div>
                  ) : (
                    lista.map((c) => (
                      <article
                        key={c.id}
                        draggable
                        onDragStart={() => setDraggedId(c.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setOverCol(null);
                        }}
                        className="group cursor-grab rounded-xl border border-[rgba(26,26,46,0.06)] bg-white p-3 active:cursor-grabbing"
                      >
                        <p className="mb-2 font-sans text-[14px] leading-snug text-[#1A1A2E]">
                          {c.titulo}
                        </p>
                        <div className="flex items-center gap-2">
                          {/* Prioridade — clique cicla */}
                          <button
                            type="button"
                            onClick={() => mudarPrioridade(c.id, proxPrioridade(c.prioridade))}
                            title="Mudar prioridade"
                            className="flex items-center gap-1 rounded-full px-1.5 py-0.5"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: corPrioridade(c.prioridade) }}
                            />
                          </button>
                          {/* Prazo — chip que abre o seletor de data */}
                          <label
                            className="relative flex cursor-pointer items-center gap-1 rounded-full bg-[rgba(26,26,46,0.05)] px-2 py-0.5 font-sans text-[11px] text-[#1A1A2E] opacity-65"
                            title="Definir prazo"
                          >
                            <CalendarDays size={11} />
                            {c.prazo ? formatarPrazo(c.prazo) : "prazo"}
                            <input
                              type="date"
                              value={c.prazo ?? ""}
                              onChange={(e) => mudarPrazo(c.id, e.target.value)}
                              className="absolute inset-0 cursor-pointer opacity-0"
                            />
                          </label>

                          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {col.id !== "concluido" && (
                              <button
                                type="button"
                                onClick={() => mover(c.id, PROXIMA[col.id])}
                                aria-label="Avançar"
                                title="Avançar"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#2D6A4F] hover:bg-[rgba(45,106,79,0.1)]"
                              >
                                <ArrowRight size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deletar(c.id)}
                              aria-label="Remover cartão"
                              title="Remover"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#1A1A2E] opacity-40 hover:bg-[rgba(201,64,122,0.1)] hover:text-[#C9407A] hover:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {membros.length > 0 && (
                          <select
                            value={c.assigned_to ?? ""}
                            onChange={(e) => mudarAssignee(c.id, e.target.value)}
                            className={`mt-2 w-full rounded-lg border px-2 py-1 font-sans text-[12px] focus:outline-none ${
                              c.assigned_to
                                ? "border-[rgba(201,107,62,0.3)] bg-[rgba(201,107,62,0.06)] text-[#C96B3E]"
                                : "border-[rgba(26,26,46,0.1)] text-[#1A1A2E] opacity-55"
                            }`}
                          >
                            <option value="">— sem responsável</option>
                            {membros.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nome}
                              </option>
                            ))}
                          </select>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
