import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { CadernoCard } from "@/components/caderno/CadernoCard";
import { getMarginalia } from "@/lib/marginaliaText";
import {
  Plus,
  Pin,
  Archive,
  Trash2,
  ArrowLeft,
  NotebookPen,
  Search,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/caderno")({
  head: () => ({
    meta: [
      { title: "Caderno · Pólia" },
      { name: "description", content: "Suas ideias, anotações e rascunhos — tudo num lugar só." },
    ],
  }),
  component: CadernoPage,
});

interface Nota {
  id: string;
  titulo: string;
  conteudo: string;
  fixada: boolean;
  arquivada: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function seedFromId(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s + id.charCodeAt(i)) % 997;
  return s;
}

function editada(n: Nota): boolean {
  return new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 60_000;
}

function resumo(conteudo: string): string {
  const t = conteudo.trim().replace(/\s+/g, " ");
  return t.length > 90 ? t.slice(0, 90) + "…" : t;
}

function CadernoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const notasQuery = useQuery({
    queryKey: ["notas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notas")
        .select("id, titulo, conteudo, fixada, arquivada, created_at, updated_at, deleted_at")
        .eq("user_id", userId!)
        .eq("arquivada", false)
        .is("deleted_at", null)
        .order("fixada", { ascending: false })
        .order("updated_at", { ascending: false });
      return (data ?? []) as Nota[];
    },
  });

  const notas = useMemo(() => notasQuery.data ?? [], [notasQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selecionada = notas.find((n) => n.id === selectedId) ?? null;

  const [busca, setBusca] = useState("");
  const [verLixeira, setVerLixeira] = useState(false);

  const lixeiraQuery = useQuery({
    queryKey: ["notas-lixeira", userId],
    enabled: !!userId && verLixeira,
    queryFn: async () => {
      const { data } = await supabase
        .from("notas")
        .select("id, titulo, conteudo, fixada, arquivada, created_at, updated_at, deleted_at")
        .eq("user_id", userId!)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      return (data ?? []) as Nota[];
    },
  });
  const lixeira = lixeiraQuery.data ?? [];

  const notasVisiveis = busca.trim()
    ? notas.filter((n) =>
        (n.titulo + " " + n.conteudo).toLowerCase().includes(busca.trim().toLowerCase()),
      )
    : notas;

  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [salvoEm, setSalvoEm] = useState(false);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["notas", userId] });
    qc.invalidateQueries({ queryKey: ["notas-lixeira", userId] });
  };

  // Carrega a nota selecionada no editor (só quando muda a seleção).
  useEffect(() => {
    const n = notas.find((x) => x.id === selectedId);
    setTitulo(n?.titulo ?? "");
    setConteudo(n?.conteudo ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const salvar = useMutation({
    mutationFn: async ({ id, t, c }: { id: string; t: string; c: string }) => {
      await supabase.from("notas").update({ titulo: t, conteudo: c }).eq("id", id);
    },
    onSuccess: () => {
      setSalvoEm(true);
      invalidar();
      window.setTimeout(() => setSalvoEm(false), 1500);
    },
  });

  // Autosave com debounce — só salva se houve mudança real.
  useEffect(() => {
    if (!selectedId) return;
    const n = notas.find((x) => x.id === selectedId);
    if (!n) return;
    if (n.titulo === titulo && n.conteudo === conteudo) return;
    const t = window.setTimeout(() => {
      salvar.mutate({ id: selectedId, t: titulo, c: conteudo });
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, conteudo, selectedId]);

  const criar = useMutation({
    mutationFn: async () => {
      const { data } = await supabase
        .from("notas")
        .insert({ user_id: userId!, titulo: "", conteudo: "" })
        .select("id")
        .single();
      return data?.id as string | undefined;
    },
    onSuccess: (id) => {
      invalidar();
      if (id) setSelectedId(id);
    },
  });

  const fixar = useMutation({
    mutationFn: async (n: Nota) => {
      await supabase.from("notas").update({ fixada: !n.fixada }).eq("id", n.id);
    },
    onSuccess: invalidar,
  });

  const arquivar = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notas").update({ arquivada: true }).eq("id", id);
    },
    onSuccess: () => {
      invalidar();
      setSelectedId(null);
    },
  });

  // "remover" = mover pra lixeira (soft delete).
  const remover = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      invalidar();
      setSelectedId(null);
    },
  });

  const restaurar = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notas").update({ deleted_at: null }).eq("id", id);
    },
    onSuccess: invalidar,
  });

  const apagarDeVez = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notas").delete().eq("id", id);
    },
    onSuccess: invalidar,
  });

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/caderno" />

      <main className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="mb-1.5 font-serif text-[34px] leading-tight text-[#1A1A2E] sm:text-[40px]">
              Caderno
            </h1>
            <p className="caveat-decorativo text-[#C96B3E]">
              suas ideias, anotações e rascunhos — num lugar só.
            </p>
          </div>
          <button
            type="button"
            onClick={() => criar.mutate()}
            disabled={criar.isPending}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-polia-terracota px-4 font-sans text-[14px] font-semibold text-polia-creme transition-colors hover:bg-[#B85A2D] disabled:opacity-50"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nova nota</span>
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
          {/* Lista (esquerda) */}
          <aside className={selectedId ? "hidden lg:block" : "block"}>
            {/* Busca + lixeira */}
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A2E] opacity-35"
                />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar anotações…"
                  className="h-10 w-full rounded-xl border border-[rgba(26,26,46,0.12)] bg-white pl-9 pr-3 font-sans text-[14px] text-[#1A1A2E] placeholder:text-[#1A1A2E] placeholder:opacity-35 focus:border-[#C96B3E] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setVerLixeira((v) => !v)}
                aria-pressed={verLixeira}
                aria-label="Lixeira"
                title="Lixeira"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  verLixeira
                    ? "border-[#C96B3E] bg-[rgba(201,107,62,0.08)] text-[#C96B3E]"
                    : "border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60 hover:opacity-100"
                }`}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {verLixeira ? (
              lixeiraQuery.isLoading ? (
                <p className="px-1 py-6 text-center font-sans text-[13px] text-[#1A1A2E] opacity-40">
                  carregando…
                </p>
              ) : lixeira.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-4 py-8 text-center font-sans text-[13px] text-[#1A1A2E] opacity-50">
                  A lixeira está vazia.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lixeira.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-center gap-2 rounded-xl border border-[rgba(26,26,46,0.08)] bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-[15px] text-[#1A1A2E] opacity-70">
                          {n.titulo.trim() || "sem título"}
                        </p>
                        <p className="truncate font-sans text-[12px] text-[#3A2A1F] opacity-40">
                          {resumo(n.conteudo) || "nota vazia"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => restaurar.mutate(n.id)}
                        aria-label="Restaurar"
                        title="Restaurar"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#2D6A4F] hover:bg-[rgba(45,106,79,0.1)]"
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Apagar de vez? Não dá pra desfazer.")) {
                            apagarDeVez.mutate(n.id);
                          }
                        }}
                        aria-label="Apagar de vez"
                        title="Apagar de vez"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#C9407A] hover:bg-[rgba(201,64,122,0.1)]"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : notasQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-white/60" />
                ))}
              </div>
            ) : notas.length === 0 ? (
              <ListaVazia onCriar={() => criar.mutate()} />
            ) : notasVisiveis.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-4 py-8 text-center font-sans text-[13px] text-[#1A1A2E] opacity-50">
                Nada encontrado pra “{busca}”.
              </p>
            ) : (
              <ul className="space-y-3">
                {notasVisiveis.map((n) => {
                  const marginalia = getMarginalia({
                    primeiraVez: n.created_at,
                    ultimaVisita: n.updated_at,
                    visitas: editada(n) ? 2 : 1,
                  });
                  return (
                    <li key={n.id}>
                      <CadernoCard
                        as="article"
                        seed={seedFromId(n.id)}
                        dobrada={editada(n)}
                        marginalia={selectedId === n.id ? null : marginalia}
                        padding={16}
                        onClick={() => setSelectedId(n.id)}
                        className={
                          selectedId === n.id
                            ? "ring-2 ring-[#C96B3E]/40"
                            : "hover:-translate-y-0.5"
                        }
                      >
                        <div className="flex items-start gap-2">
                          {n.fixada && (
                            <Pin
                              size={13}
                              className="mt-1 shrink-0 text-[#C96B3E]"
                              fill="#C96B3E"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-serif text-[16px] text-[#1A1A2E]">
                              {n.titulo.trim() || "sem título"}
                            </p>
                            <p className="mt-0.5 line-clamp-2 font-sans text-[12.5px] leading-snug text-[#3A2A1F] opacity-55">
                              {resumo(n.conteudo) || "nota vazia"}
                            </p>
                          </div>
                        </div>
                      </CadernoCard>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Editor (direita) */}
          <section className={selectedId ? "block" : "hidden lg:block"}>
            {selecionada ? (
              <div className="rounded-2xl border border-[rgba(58,42,31,0.08)] bg-[#FDFCFA] p-5 sm:p-7">
                {/* Barra do editor */}
                <div className="mb-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="flex items-center gap-1.5 font-sans text-[13px] text-[#1A1A2E] opacity-60 hover:opacity-100 lg:hidden"
                  >
                    <ArrowLeft size={15} /> voltar
                  </button>
                  <span
                    className={`caveat-decorativo ml-auto text-[13px] text-[#2D6A4F] transition-opacity ${
                      salvoEm ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    salvo.
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fixar.mutate(selecionada)}
                      aria-label={selecionada.fixada ? "Desafixar" : "Fixar no topo"}
                      title={selecionada.fixada ? "Desafixar" : "Fixar no topo"}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[rgba(58,42,31,0.05)] ${
                        selecionada.fixada ? "text-[#C96B3E]" : "text-[#3A2A1F] opacity-45"
                      }`}
                    >
                      <Pin size={16} fill={selecionada.fixada ? "#C96B3E" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => arquivar.mutate(selecionada.id)}
                      aria-label="Arquivar nota"
                      title="Arquivar"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#3A2A1F] opacity-45 transition-colors hover:bg-[rgba(58,42,31,0.05)] hover:opacity-80"
                    >
                      <Archive size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remover.mutate(selecionada.id)}
                      aria-label="Mover para a lixeira"
                      title="Mover para a lixeira"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#3A2A1F] opacity-45 transition-colors hover:bg-[rgba(201,64,122,0.1)] hover:text-[#C9407A] hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={160}
                  placeholder="Título da nota"
                  className="mb-3 w-full bg-transparent font-serif text-[26px] leading-tight text-[#1A1A2E] placeholder:text-[#3A2A1F] placeholder:opacity-25 focus:outline-none"
                />
                <textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Comece a escrever…"
                  className="min-h-[48vh] w-full resize-none bg-transparent font-sans text-[15.5px] leading-[1.85] text-[#3A2A1F] placeholder:text-[#3A2A1F] placeholder:opacity-25 focus:outline-none"
                />
              </div>
            ) : (
              <div className="hidden h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/40 px-6 text-center lg:flex">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(201,107,62,0.1)]">
                  <NotebookPen size={22} className="text-polia-terracota" />
                </div>
                <p className="font-sans text-[14px] text-[#1A1A2E] opacity-55">
                  Escolha uma nota à esquerda ou crie uma nova.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function ListaVazia({ onCriar }: { onCriar: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(201,107,62,0.1)]">
        <NotebookPen size={22} className="text-polia-terracota" />
      </div>
      <p className="mb-3 font-sans text-[14px] leading-relaxed text-[#1A1A2E] opacity-55">
        Seu caderno está em branco. A primeira página é sua.
      </p>
      <button
        type="button"
        onClick={onCriar}
        className="font-sans text-[13px] font-semibold text-[#C96B3E] hover:underline"
      >
        + criar a primeira nota
      </button>
    </div>
  );
}
