import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Target, Plus, Check, Archive, RotateCcw, Trash2, CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas · Pólia" },
      { name: "description", content: "Onde você quer chegar — e o quanto já andou." },
    ],
  }),
  component: MetasPage,
});

type Status = "ativa" | "concluida" | "arquivada";

interface Meta {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  progresso: number;
  prazo: string | null;
  concluida_em: string | null;
  created_at: string;
}

const PROGRESSOS = [0, 25, 50, 75, 100];

function formatarPrazo(prazo: string): string {
  const d = new Date(prazo + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function MetasPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const metasQuery = useQuery({
    queryKey: ["metas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("metas")
        .select("id, titulo, descricao, status, progresso, prazo, concluida_em, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as Meta[];
    },
  });

  const metas = metasQuery.data ?? [];
  const ativas = metas.filter((m) => m.status === "ativa");
  const concluidas = metas.filter((m) => m.status === "concluida");
  const arquivadas = metas.filter((m) => m.status === "arquivada");

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoPrazo, setNovoPrazo] = useState("");
  const [compositorAberto, setCompositorAberto] = useState(false);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["metas", userId] });

  const adicionar = useMutation({
    mutationFn: async () => {
      const titulo = novoTitulo.trim();
      if (!titulo) return;
      await supabase.from("metas").insert({
        user_id: userId!,
        titulo,
        prazo: novoPrazo || null,
      });
    },
    onSuccess: () => {
      setNovoTitulo("");
      setNovoPrazo("");
      setCompositorAberto(false);
      invalidar();
    },
  });

  const setProgresso = useMutation({
    mutationFn: async ({ id, progresso }: { id: string; progresso: number }) => {
      await supabase.from("metas").update({ progresso }).eq("id", id);
    },
    onSuccess: invalidar,
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      await supabase
        .from("metas")
        .update({
          status,
          concluida_em: status === "concluida" ? new Date().toISOString() : null,
          ...(status === "concluida" ? { progresso: 100 } : {}),
        })
        .eq("id", id);
    },
    onSuccess: invalidar,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("metas").delete().eq("id", id);
    },
    onSuccess: invalidar,
  });

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/metas" />

      <main className="mx-auto max-w-[760px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 font-serif text-[36px] leading-tight text-[#1A1A2E] sm:text-[40px]">
              Metas
            </h1>
            <p className="caveat-decorativo text-[#C96B3E]">
              onde você quer chegar — e o quanto já andou.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCompositorAberto((v) => !v)}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-polia-terracota px-4 font-sans text-[14px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D]"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nova meta</span>
          </button>
        </div>

        {/* Compositor */}
        {compositorAberto && (
          <section className="mb-8 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5">
            <input
              type="text"
              autoFocus
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novoTitulo.trim()) adicionar.mutate();
              }}
              maxLength={120}
              placeholder="Ex: chegar a 30 clientes fixas · lançar a linha de inverno"
              className="mb-3 w-full rounded-xl border border-[rgba(26,26,46,0.12)] px-4 py-3 font-sans text-[15px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-30 focus:border-[#C96B3E] focus:shadow-[0_0_0_3px_rgba(201,107,62,0.08)] focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 font-sans text-[13px] text-[#1A1A2E] opacity-70">
                <CalendarDays size={15} className="opacity-60" />
                até quando?
                <input
                  type="date"
                  value={novoPrazo}
                  onChange={(e) => setNovoPrazo(e.target.value)}
                  className="rounded-lg border border-[rgba(26,26,46,0.12)] px-3 py-1.5 font-sans text-[13px] text-[#1A1A2E] focus:border-[#C96B3E] focus:outline-none"
                />
              </label>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompositorAberto(false);
                    setNovoTitulo("");
                    setNovoPrazo("");
                  }}
                  className="rounded-xl border border-[rgba(26,26,46,0.12)] px-4 py-2 font-sans text-[13px] text-[#1A1A2E] hover:bg-[rgba(26,26,46,0.04)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => adicionar.mutate()}
                  disabled={!novoTitulo.trim() || adicionar.isPending}
                  className="rounded-xl bg-polia-terracota px-4 py-2 font-sans text-[13px] font-semibold text-polia-creme hover:bg-[#B85A2D] disabled:opacity-40"
                >
                  Criar meta
                </button>
              </div>
            </div>
          </section>
        )}

        <Tabs defaultValue="ativa">
          <TabsList className="mb-6 bg-[rgba(26,26,46,0.04)]">
            <TabsTrigger value="ativa">Ativas · {ativas.length}</TabsTrigger>
            <TabsTrigger value="concluida">Concluídas · {concluidas.length}</TabsTrigger>
            <TabsTrigger value="arquivada">Arquivadas · {arquivadas.length}</TabsTrigger>
          </TabsList>

          <TabsContent value="ativa">
            <Lista
              metas={ativas}
              vazio="Nenhuma meta ativa. Que tal definir onde você quer chegar?"
              onProgresso={(id, progresso) => setProgresso.mutate({ id, progresso })}
              onConcluir={(id) => mudarStatus.mutate({ id, status: "concluida" })}
              onArquivar={(id) => mudarStatus.mutate({ id, status: "arquivada" })}
              onRemover={(id) => remover.mutate(id)}
            />
          </TabsContent>
          <TabsContent value="concluida">
            <Lista
              metas={concluidas}
              vazio="Suas metas concluídas vão aparecer aqui. A primeira vem chegando."
              onReativar={(id) => mudarStatus.mutate({ id, status: "ativa" })}
              onRemover={(id) => remover.mutate(id)}
            />
          </TabsContent>
          <TabsContent value="arquivada">
            <Lista
              metas={arquivadas}
              vazio="Nada arquivado. Metas que saíram do radar ficam guardadas aqui."
              onReativar={(id) => mudarStatus.mutate({ id, status: "ativa" })}
              onRemover={(id) => remover.mutate(id)}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Lista({
  metas,
  vazio,
  onProgresso,
  onConcluir,
  onArquivar,
  onReativar,
  onRemover,
}: {
  metas: Meta[];
  vazio: string;
  onProgresso?: (id: string, progresso: number) => void;
  onConcluir?: (id: string) => void;
  onArquivar?: (id: string) => void;
  onReativar?: (id: string) => void;
  onRemover: (id: string) => void;
}) {
  if (metas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(201,107,62,0.1)]">
          <Target size={22} className="text-polia-terracota" />
        </div>
        <p className="mx-auto max-w-[360px] font-sans text-[14px] leading-relaxed text-[#1A1A2E] opacity-55">
          {vazio}
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {metas.map((m) => (
        <MetaCard
          key={m.id}
          meta={m}
          onProgresso={onProgresso}
          onConcluir={onConcluir}
          onArquivar={onArquivar}
          onReativar={onReativar}
          onRemover={onRemover}
        />
      ))}
    </ul>
  );
}

function MetaCard({
  meta,
  onProgresso,
  onConcluir,
  onArquivar,
  onReativar,
  onRemover,
}: {
  meta: Meta;
  onProgresso?: (id: string, progresso: number) => void;
  onConcluir?: (id: string) => void;
  onArquivar?: (id: string) => void;
  onReativar?: (id: string) => void;
  onRemover: (id: string) => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const concluida = meta.status === "concluida";

  return (
    <li className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`font-sans text-[16px] font-medium ${
              concluida ? "text-[#1A1A2E] line-through opacity-55" : "text-[#1A1A2E]"
            }`}
          >
            {meta.titulo}
          </p>
          {meta.descricao && (
            <p className="mt-1 font-sans text-[13px] leading-relaxed text-[#1A1A2E] opacity-55">
              {meta.descricao}
            </p>
          )}
          {meta.prazo && !concluida && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[rgba(26,26,46,0.05)] px-2.5 py-1 font-sans text-[12px] text-[#1A1A2E] opacity-65">
              <CalendarDays size={12} /> até {formatarPrazo(meta.prazo)}
            </span>
          )}
        </div>

        {/* Ações */}
        <div className="flex shrink-0 items-center gap-1">
          {onConcluir && (
            <button
              type="button"
              onClick={() => onConcluir(meta.id)}
              aria-label="Marcar como concluída"
              title="Concluir"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#2D6A4F] transition-colors hover:bg-[rgba(45,106,79,0.1)]"
            >
              <Check size={17} />
            </button>
          )}
          {onArquivar && (
            <button
              type="button"
              onClick={() => onArquivar(meta.id)}
              aria-label="Arquivar meta"
              title="Arquivar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1A2E] opacity-40 transition-all hover:bg-[rgba(26,26,46,0.05)] hover:opacity-70"
            >
              <Archive size={16} />
            </button>
          )}
          {onReativar && (
            <button
              type="button"
              onClick={() => onReativar(meta.id)}
              aria-label="Reativar meta"
              title="Reativar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#C96B3E] transition-colors hover:bg-[rgba(201,107,62,0.1)]"
            >
              <RotateCcw size={16} />
            </button>
          )}
          {confirmar ? (
            <button
              type="button"
              onClick={() => onRemover(meta.id)}
              className="flex h-9 items-center gap-1 rounded-lg bg-[rgba(201,64,122,0.1)] px-2.5 font-sans text-[12px] font-medium text-[#C9407A]"
            >
              <Trash2 size={13} /> confirmar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              onBlur={() => setConfirmar(false)}
              aria-label="Remover meta"
              title="Remover"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1A1A2E] opacity-25 transition-all hover:bg-[rgba(26,26,46,0.05)] hover:opacity-60"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Progresso */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-sans text-[12px] font-semibold text-[#1A1A2E] opacity-60">
            {meta.progresso}%
          </span>
          {concluida && meta.concluida_em && (
            <span className="caveat-decorativo text-[13px] text-[#2D6A4F]">concluída 🌿</span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(26,26,46,0.07)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${meta.progresso}%`,
              background: concluida ? "#2D6A4F" : "#C96B3E",
            }}
          />
        </div>
        {onProgresso && (
          <div className="mt-3 flex gap-1.5">
            {PROGRESSOS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onProgresso(meta.id, p)}
                className={`flex-1 rounded-lg border py-1.5 font-sans text-[12px] transition-colors ${
                  meta.progresso === p
                    ? "border-[#C96B3E] bg-[rgba(201,107,62,0.08)] font-semibold text-[#C96B3E]"
                    : "border-[rgba(26,26,46,0.1)] text-[#1A1A2E] opacity-55 hover:opacity-90"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
