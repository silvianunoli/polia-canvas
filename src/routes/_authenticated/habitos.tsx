import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { Flame, Plus, Check, X, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos · Pólia" },
      {
        name: "description",
        content: "Os pequenos gestos que constroem seu negócio, um dia de cada vez.",
      },
    ],
  }),
  component: HabitosPage,
});

interface Habito {
  id: string;
  nome: string;
  emoji: string | null;
  cor: string | null;
  categoria: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

interface HabitoLog {
  habito_id: string;
  data: string;
}

const EMOJIS = ["☀️", "📦", "💬", "✍️", "📸", "💰", "🧘", "📚", "🌱", "🎯"];

// Paleta territorial — cor de acento por hábito, ciclada pela ordem.
const ACENTOS = ["#C96B3E", "#2D6A4F", "#C8A96E", "#1A7FAD", "#B8862E", "#6B50CC"];

const CATEGORIAS = [
  { v: "trabalho", label: "Trabalho" },
  { v: "saude", label: "Saúde" },
  { v: "aprendizado", label: "Aprendizado" },
  { v: "pessoal", label: "Pessoal" },
];
const labelCategoria = (v: string | null) => CATEGORIAS.find((c) => c.v === v)?.label ?? null;

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Dias seguidos a partir de hoje (ou de ontem, se hoje ainda vazio).
function computeStreak(dates: Set<string>): number {
  let streak = 0;
  let skipped = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (true) {
    const key = localDateKey(cursor);
    if (dates.has(key)) {
      streak += 1;
      skipped = 0;
    } else if (streak === 0 && skipped === 0) {
      skipped = 1;
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function HabitosPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const hoje = localDateKey();

  const habitosQuery = useQuery({
    queryKey: ["habitos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("habitos")
        .select("id, nome, emoji, cor, categoria, ativo, ordem, created_at")
        .eq("user_id", userId!)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as Habito[];
    },
  });

  // Logs dos últimos 90 dias — base pra "feito hoje" e pro streak.
  const logsQuery = useQuery({
    queryKey: ["habito-logs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - 90);
      const { data } = await supabase
        .from("habito_logs")
        .select("habito_id, data")
        .eq("user_id", userId!)
        .gte("data", localDateKey(desde));
      return (data ?? []) as HabitoLog[];
    },
  });

  const habitos = habitosQuery.data ?? [];

  // Mapa habito_id -> Set de datas marcadas.
  const datasPorHabito = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of logsQuery.data ?? []) {
      if (!m.has(l.habito_id)) m.set(l.habito_id, new Set());
      m.get(l.habito_id)!.add(l.data);
    }
    return m;
  }, [logsQuery.data]);

  const toggleHoje = useMutation({
    mutationFn: async (habito: Habito) => {
      const feito = datasPorHabito.get(habito.id)?.has(hoje) ?? false;
      if (feito) {
        await supabase.from("habito_logs").delete().eq("habito_id", habito.id).eq("data", hoje);
      } else {
        await supabase
          .from("habito_logs")
          .insert({ habito_id: habito.id, user_id: userId!, data: hoje });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habito-logs", userId] }),
  });

  const [novoNome, setNovoNome] = useState("");
  const [novoEmoji, setNovoEmoji] = useState(EMOJIS[0]);
  const [novaCategoria, setNovaCategoria] = useState<string>("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");

  const adicionar = useMutation({
    mutationFn: async () => {
      const nome = novoNome.trim();
      if (!nome) return;
      await supabase.from("habitos").insert({
        user_id: userId!,
        nome,
        emoji: novoEmoji,
        categoria: novaCategoria || null,
        ordem: habitos.length,
      });
    },
    onSuccess: () => {
      setNovoNome("");
      setNovoEmoji(EMOJIS[0]);
      setNovaCategoria("");
      qc.invalidateQueries({ queryKey: ["habitos", userId] });
    },
  });

  const habitosFiltrados = filtroCategoria
    ? habitos.filter((h) => h.categoria === filtroCategoria)
    : habitos;
  const feitosHoje = habitosFiltrados.filter((h) => datasPorHabito.get(h.id)?.has(hoje)).length;

  const remover = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("habitos").update({ ativo: false }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habitos", userId] }),
  });

  const carregando = habitosQuery.isLoading || logsQuery.isLoading;

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/habitos" />

      <main className="mx-auto max-w-[760px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-8">
          <h1 className="mb-2 font-serif text-[36px] leading-tight text-[#1A1A2E] sm:text-[40px]">
            Hábitos
          </h1>
          <p className="caveat-decorativo text-[#C96B3E]">
            os pequenos gestos que constroem seu negócio, um dia de cada vez.
          </p>
        </div>

        {/* Compositor — novo hábito */}
        <section className="mb-8 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5">
          <p className="mb-3 font-accent text-[9px] font-bold uppercase tracking-[1.5px] text-[#1A1A2E] opacity-50">
            Novo hábito
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setNovoEmoji(e)}
                  aria-label={`Ícone ${e}`}
                  aria-pressed={novoEmoji === e}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-[18px] transition-colors ${
                    novoEmoji === e
                      ? "bg-[rgba(201,107,62,0.12)] ring-1 ring-[#C96B3E]"
                      : "hover:bg-[rgba(26,26,46,0.04)]"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && novoNome.trim()) adicionar.mutate();
                }}
                maxLength={60}
                placeholder="Ex: postar um story · responder clientes · separar pedidos"
                className="h-[46px] w-full rounded-xl border border-[rgba(26,26,46,0.12)] px-4 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => adicionar.mutate()}
                disabled={!novoNome.trim() || adicionar.isPending}
                className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-xl bg-polia-terracota px-4 font-sans text-[14px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D] disabled:opacity-40"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Adicionar</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgba(26,26,46,0.06)] pt-3">
            <span className="font-sans text-[13px] text-[#1A1A2E] opacity-50">Categoria:</span>
            {CATEGORIAS.map((c) => {
              const ativo = novaCategoria === c.v;
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setNovaCategoria(ativo ? "" : c.v)}
                  className={
                    ativo
                      ? "rounded-full bg-polia-terracota px-3 py-1 font-sans text-[12px] font-semibold text-polia-creme"
                      : "rounded-full border border-[rgba(26,26,46,0.15)] px-3 py-1 font-sans text-[12px] text-[#1A1A2E] opacity-70 hover:opacity-100"
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Filtro por categoria + contador do dia */}
        {habitos.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <FiltroChip
                label="Todos"
                ativo={filtroCategoria === ""}
                onClick={() => setFiltroCategoria("")}
              />
              {CATEGORIAS.map((c) => (
                <FiltroChip
                  key={c.v}
                  label={c.label}
                  ativo={filtroCategoria === c.v}
                  onClick={() => setFiltroCategoria(filtroCategoria === c.v ? "" : c.v)}
                />
              ))}
            </div>
            <span className="shrink-0 font-sans text-[13px] font-semibold text-[#C96B3E]">
              {feitosHoje} de {habitosFiltrados.length} feitos hoje
            </span>
          </div>
        )}

        {/* Lista / empty state */}
        {carregando ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white/60"
              />
            ))}
          </div>
        ) : habitos.length === 0 ? (
          <EmptyState />
        ) : habitosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-6 py-10 text-center font-sans text-[14px] text-[#1A1A2E] opacity-55">
            Nenhum hábito nesta categoria ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            {habitosFiltrados.map((h, i) => {
              const datas = datasPorHabito.get(h.id) ?? new Set<string>();
              const feitoHoje = datas.has(hoje);
              const streak = computeStreak(datas);
              const acento = h.cor || ACENTOS[i % ACENTOS.length];
              return (
                <HabitoRow
                  key={h.id}
                  habito={h}
                  acento={acento}
                  feitoHoje={feitoHoje}
                  streak={streak}
                  togglePending={toggleHoje.isPending}
                  onToggle={() => toggleHoje.mutate(h)}
                  onRemove={() => remover.mutate(h.id)}
                />
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function HabitoRow({
  habito,
  acento,
  feitoHoje,
  streak,
  togglePending,
  onToggle,
  onRemove,
}: {
  habito: Habito;
  acento: string;
  feitoHoje: boolean;
  streak: number;
  togglePending: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);

  return (
    <li
      className="flex items-center gap-4 rounded-2xl border bg-white p-4 transition-shadow"
      style={{
        borderColor: feitoHoje ? `${acento}55` : "rgba(26,26,46,0.06)",
        boxShadow: feitoHoje ? `inset 3px 0 0 ${acento}` : "none",
      }}
    >
      {/* Botão marcar hoje */}
      <button
        type="button"
        onClick={onToggle}
        disabled={togglePending}
        aria-pressed={feitoHoje}
        aria-label={
          feitoHoje ? `Desmarcar ${habito.nome} de hoje` : `Marcar ${habito.nome} como feito hoje`
        }
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all disabled:opacity-50"
        style={{
          borderColor: acento,
          background: feitoHoje ? acento : "transparent",
        }}
      >
        {feitoHoje ? (
          <Check size={20} className="text-white" strokeWidth={3} />
        ) : (
          <span className="text-[20px] leading-none">{habito.emoji ?? "•"}</span>
        )}
      </button>

      {/* Nome + streak */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[16px] font-medium text-[#1A1A2E]">{habito.nome}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {streak > 0 ? (
            <>
              <Flame size={14} style={{ color: acento }} />
              <span className="font-sans text-[13px] font-semibold" style={{ color: acento }}>
                {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
              </span>
            </>
          ) : (
            <span className="font-sans text-[13px] text-[#1A1A2E] opacity-40">
              {feitoHoje ? "começou hoje" : "comece hoje"}
            </span>
          )}
          {labelCategoria(habito.categoria) && (
            <span className="font-sans text-[12px] text-[#1A1A2E] opacity-35">
              · {labelCategoria(habito.categoria)}
            </span>
          )}
        </div>
      </div>

      {/* Remover */}
      {confirmar ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRemove}
            className="flex h-9 items-center gap-1 rounded-lg bg-[rgba(201,64,122,0.1)] px-3 font-sans text-[13px] font-medium text-[#C9407A] hover:bg-[rgba(201,64,122,0.16)]"
          >
            <Trash2 size={14} /> Remover
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(false)}
            aria-label="Cancelar remoção"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1A2E] opacity-50 hover:bg-[rgba(26,26,46,0.05)]"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          aria-label={`Remover hábito ${habito.nome}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1A2E] opacity-25 transition-opacity hover:bg-[rgba(26,26,46,0.05)] hover:opacity-60"
        >
          <Trash2 size={16} />
        </button>
      )}
    </li>
  );
}

function FiltroChip({
  label,
  ativo,
  onClick,
}: {
  label: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={
        ativo
          ? "rounded-full bg-[#0E1731] px-3.5 py-1.5 font-sans text-[13px] font-medium text-white"
          : "rounded-full border border-[rgba(26,26,46,0.15)] px-3.5 py-1.5 font-sans text-[13px] text-[#1A1A2E] opacity-70 hover:opacity-100"
      }
    >
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(201,107,62,0.1)]">
        <Flame size={26} className="text-polia-terracota" />
      </div>
      <p className="mb-1.5 font-serif text-[20px] text-[#1A1A2E]">Nenhum hábito por aqui ainda</p>
      <p className="mx-auto max-w-[380px] font-sans text-[14px] leading-relaxed text-[#1A1A2E] opacity-55">
        Comece com um só. O que você quer fazer todos os dias pelo seu negócio? Use o campo acima.
      </p>
    </div>
  );
}
