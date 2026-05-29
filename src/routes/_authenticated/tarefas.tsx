import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { pluralizeKanban } from "@/lib/kanban";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Pólia" },
      {
        name: "description",
        content: "Seu fluxo de tarefas: sementes, brotos e o que já floresceu.",
      },
    ],
  }),
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
  component: TarefasPage,
});

type Status = "a_fazer" | "brotando" | "floresceu";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  fonte: string;
  etapa: number | null;
  created_at: string;
}

const COLUNAS: { id: Status; label: string; cor: string; bg: string }[] = [
  { id: "a_fazer", label: "A fazer", cor: "#1A1A2E", bg: "rgba(26,26,46,0.06)" },
  { id: "brotando", label: "Brotando", cor: "#1A7FAD", bg: "rgba(26,127,173,0.08)" },
  { id: "floresceu", label: "Floresceram", cor: "#2D6A4F", bg: "rgba(44,106,79,0.08)" },
];

const proximaColuna = (s: Status): Status =>
  s === "a_fazer" ? "brotando" : "floresceu";

function TarefasPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const [filtroEtapa, setFiltroEtapa] = useState<string>("");
  const [filtroFonte, setFiltroFonte] = useState<string>("");
  const [modalAberto, setModalAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const profileQuery = useQuery({
    queryKey: ["tarefas-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const tarefasQuery = useQuery<Tarefa[]>({
    queryKey: ["tarefas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, descricao, status, fonte, etapa, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as Tarefa[];
    },
  });

  const tarefas = tarefasQuery.data ?? [];

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (filtroEtapa === "manual" && t.etapa !== null) return false;
      if (filtroEtapa !== "" && filtroEtapa !== "manual") {
        if (String(t.etapa) !== filtroEtapa) return false;
      }
      if (filtroFonte && t.fonte !== filtroFonte) return false;
      return true;
    });
  }, [tarefas, filtroEtapa, filtroFonte]);

  const counts = useMemo(() => {
    return {
      a_fazer: tarefas.filter((t) => t.status === "a_fazer").length,
      brotando: tarefas.filter((t) => t.status === "brotando").length,
      floresceu: tarefas.filter((t) => t.status === "floresceu").length,
    };
  }, [tarefas]);

  const updateLocal = (mutator: (list: Tarefa[]) => Tarefa[]) => {
    qc.setQueryData<Tarefa[]>(["tarefas", userId], (old) =>
      mutator(old ?? []),
    );
  };

  const moverTarefa = async (id: string, novoStatus: Status) => {
    updateLocal((list) =>
      list.map((t) => (t.id === id ? { ...t, status: novoStatus } : t)),
    );
    await supabase
      .from("tarefas")
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
  };

  const deletarTarefa = async (id: string) => {
    updateLocal((list) => list.filter((t) => t.id !== id));
    await supabase.from("tarefas").delete().eq("id", id);
  };

  const criarTarefa = async () => {
    if (!userId || titulo.trim().length < 3) return;
    const { data } = await supabase
      .from("tarefas")
      .insert({
        user_id: userId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        status: "a_fazer",
        fonte: "manual",
      })
      .select("id, titulo, descricao, status, fonte, etapa, created_at")
      .single();
    if (data) {
      updateLocal((list) => [data as Tarefa, ...list]);
    }
    setTitulo("");
    setDescricao("");
    setModalAberto(false);
  };

  const initial =
    (profileQuery.data?.full_name ?? user?.user_metadata?.full_name ?? "P")
      .charAt(0)
      .toUpperCase() || "P";

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav initial={initial} streak={0} navActive="/tarefas" />

      {/* CABEÇALHO */}
      <section className="px-6 pb-6 pt-10 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <h1 className="mb-1 font-serif text-[40px] leading-tight text-[#1A1A2E]">
            Seu fluxo de hoje.
          </h1>
          <p className="font-handwritten text-[18px] text-[#C96B3E]">
            {pluralizeKanban(counts)}
          </p>

          {/* FILTROS */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(26,26,46,0.08)] bg-white px-4 py-2">
              <span className="font-sans text-[13px] text-[#1A1A2E] opacity-50">
                Etapa:
              </span>
              <select
                value={filtroEtapa}
                onChange={(e) => setFiltroEtapa(e.target.value)}
                className="cursor-pointer bg-transparent font-sans text-[13px] text-[#1A1A2E] outline-none"
              >
                <option value="">Todas</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                  <option key={n} value={n}>
                    Etapa {n}
                  </option>
                ))}
                <option value="manual">Criadas por mim</option>
              </select>
            </div>

            <button
              onClick={() =>
                setFiltroFonte((f) => (f === "sistema" ? "" : "sistema"))
              }
              className={`rounded-xl border px-4 py-2 font-sans text-[13px] transition-colors ${
                filtroFonte === "sistema"
                  ? "border-[#C96B3E] bg-[#C96B3E] text-[#FDF8F5]"
                  : "border-[rgba(26,26,46,0.08)] bg-white text-[#1A1A2E]"
              }`}
            >
              Do sistema
            </button>
            <button
              onClick={() =>
                setFiltroFonte((f) => (f === "manual" ? "" : "manual"))
              }
              className={`rounded-xl border px-4 py-2 font-sans text-[13px] transition-colors ${
                filtroFonte === "manual"
                  ? "border-[#C96B3E] bg-[#C96B3E] text-[#FDF8F5]"
                  : "border-[rgba(26,26,46,0.08)] bg-white text-[#1A1A2E]"
              }`}
            >
              Minhas
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setModalAberto(true)}
              className="rounded-xl bg-[#C96B3E] px-5 py-2.5 font-sans text-[14px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D]"
            >
              + Nova tarefa
            </button>
          </div>
        </div>
      </section>

      {/* KANBAN */}
      <section className="px-6 pb-16 pt-4 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
            {COLUNAS.map((col) => {
              const lista = tarefasFiltradas.filter(
                (t) => t.status === col.id,
              );
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
                      moverTarefa(draggedId, col.id);
                      setDraggedId(null);
                      setOverCol(null);
                    }
                  }}
                  className={`rounded-xl p-3 transition-colors ${
                    ativa
                      ? "border border-[rgba(201,107,62,0.4)] bg-[rgba(201,107,62,0.04)]"
                      : "border border-transparent"
                  }`}
                  style={!ativa ? { background: col.bg } : undefined}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-accent text-[11px] font-bold uppercase tracking-[1.5px]"
                        style={{ color: col.cor }}
                      >
                        {col.label}
                      </span>
                      <span className="rounded-full bg-[rgba(26,26,46,0.06)] px-2 py-0.5 font-sans text-[12px] text-[#1A1A2E] opacity-40">
                        {lista.length}
                      </span>
                    </div>
                    {col.id === "a_fazer" && (
                      <button
                        onClick={() => setModalAberto(true)}
                        className="font-sans text-[20px] leading-none text-[#C96B3E] opacity-50 hover:opacity-100"
                      >
                        +
                      </button>
                    )}
                  </div>

                  {lista.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-[rgba(26,26,46,0.08)] p-8 text-center">
                      <p className="font-handwritten text-[15px] text-[#1A1A2E] opacity-30">
                        {col.id === "a_fazer" && "nada por aqui ainda."}
                        {col.id === "brotando" &&
                          "mova uma tarefa pra cá quando começar."}
                        {col.id === "floresceu" &&
                          "suas conquistas aparecem aqui."}
                      </p>
                    </div>
                  ) : (
                    lista.map((t) => (
                      <CardTarefa
                        key={t.id}
                        tarefa={t}
                        colId={col.id}
                        onDragStart={() => setDraggedId(t.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setOverCol(null);
                        }}
                        onMover={() => moverTarefa(t.id, proximaColuna(col.id))}
                        onDeletar={() => deletarTarefa(t.id)}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* MODAL */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,26,46,0.6)" }}
          onClick={() => setModalAberto(false)}
        >
          <div
            className="mx-auto w-full max-w-[480px] rounded-2xl bg-[#FDF8F5] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-6 font-serif text-[28px] text-[#1A1A2E]">
              Nova tarefa
            </h2>

            <label className="mb-2 block font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-50">
              TÍTULO
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={100}
              placeholder="Ex: Revisar bio do Instagram com novo posicionamento"
              className="mb-5 h-[48px] w-full rounded-xl border border-[rgba(26,26,46,0.12)] px-4 font-sans text-[15px] text-[#1A1A2E] transition-all placeholder:opacity-40 focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] focus:outline-none"
            />

            <label className="mb-2 block font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-50">
              DESCRIÇÃO (OPCIONAL)
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Detalhes, contexto ou referências..."
              className="mb-6 w-full resize-none rounded-xl border border-[rgba(26,26,46,0.12)] px-4 py-3 font-sans text-[14px] text-[#1A1A2E] transition-all placeholder:opacity-40 focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] focus:outline-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setModalAberto(false)}
                className="h-[48px] flex-1 rounded-xl border border-[rgba(26,26,46,0.12)] font-sans text-[15px] text-[#1A1A2E] transition-colors hover:bg-[rgba(26,26,46,0.04)]"
              >
                Cancelar
              </button>
              <button
                onClick={criarTarefa}
                disabled={titulo.trim().length < 3}
                className="h-[48px] flex-1 rounded-xl bg-[#C96B3E] font-sans text-[15px] font-semibold text-[#FDF8F5] transition-colors hover:bg-[#B85A2D] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Criar tarefa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardTarefa({
  tarefa,
  colId,
  onDragStart,
  onDragEnd,
  onMover,
  onDeletar,
}: {
  tarefa: Tarefa;
  colId: Status;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMover: () => void;
  onDeletar: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group mb-3 cursor-grab rounded-xl border border-[rgba(26,26,46,0.06)] bg-white p-4 shadow-sm transition-colors hover:border-[rgba(201,107,62,0.2)] active:cursor-grabbing"
    >
      <div className="mb-3 flex items-center gap-2">
        {tarefa.etapa ? (
          <span className="rounded-full bg-[rgba(26,26,46,0.06)] px-2 py-0.5 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-50">
            Etapa {tarefa.etapa}
          </span>
        ) : (
          <span className="rounded-full bg-[rgba(201,107,62,0.08)] px-2 py-0.5 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#C96B3E]">
            Minha
          </span>
        )}
      </div>

      <p className="mb-3 font-sans text-[14px] leading-snug text-[#1A1A2E]">
        {tarefa.titulo}
      </p>

      {tarefa.descricao && (
        <p className="mb-3 line-clamp-2 font-sans text-[12px] leading-relaxed text-[#1A1A2E] opacity-40">
          {tarefa.descricao}
        </p>
      )}

      <div className="flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex gap-1">
          {colId !== "floresceu" ? (
            <button
              onClick={onMover}
              className="rounded-lg border border-[rgba(201,107,62,0.3)] px-2 py-1 font-sans text-[11px] text-[#C96B3E] hover:bg-[rgba(201,107,62,0.06)]"
            >
              {colId === "a_fazer" ? "Brotar" : "Florescer"}
            </button>
          ) : (
            <span className="font-handwritten text-[11px] text-[#2D6A4F]">
              feita
            </span>
          )}
        </div>
        {tarefa.fonte === "manual" && (
          <button
            onClick={onDeletar}
            className="font-sans text-[11px] text-[#1A1A2E] opacity-30 hover:text-[#C9407A] hover:opacity-60"
          >
            remover
          </button>
        )}
      </div>
    </div>
  );
}
