import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PainelNav } from "@/components/painel/PainelNav";
import { toastErro } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { Plus, Pin, Trash2, ArrowLeft, NotebookPen, Search, Lock } from "lucide-react";
import { COTAS_CONFERE } from "@/lib/planos";

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

export const Route = createFileRoute("/_authenticated/caderno")({
  head: () => ({
    meta: [
      { title: "Caderno · Pólia" },
      { name: "description", content: "Suas ideias, anotações e rascunhos · tudo num lugar só." },
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

/** Envolve a primeira ocorrência (case-insensitive) do termo em <mark>. */
function destacar(texto: string, termo: string): ReactNode {
  if (!termo) return texto;
  const i = texto.toLowerCase().indexOf(termo.toLowerCase());
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="rounded-[3px] bg-[var(--secondary-light)] text-[var(--ink)]">
        {texto.slice(i, i + termo.length)}
      </mark>
      {texto.slice(i + termo.length)}
    </>
  );
}

function CadernoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const meta = useUserMeta();
  const ehConfere = meta.plano === "confere";

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
  const reduceMotion = usePrefersReducedMotion();

  // Cota do Confere: 1 nota ativa. As mais antigas por created_at ficam
  // dentro da cota; o excedente (de um downgrade, por ex.) vira somente
  // leitura — mesma regra imposta pela trigger do banco (20260727130000).
  const idsExcedentes = useMemo(() => {
    if (!ehConfere) return new Set<string>();
    const porCriacao = [...notas].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return new Set(porCriacao.slice(COTAS_CONFERE.caderno).map((n) => n.id));
  }, [ehConfere, notas]);
  const cotaAtingida = ehConfere && notas.length >= COTAS_CONFERE.caderno;
  const notaExcedente = selecionada ? idsExcedentes.has(selecionada.id) : false;

  const [busca, setBusca] = useState("");

  const notasVisiveis = busca.trim()
    ? notas.filter((n) =>
        (n.titulo + " " + n.conteudo).toLowerCase().includes(busca.trim().toLowerCase()),
      )
    : notas;

  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [salvoEm, setSalvoEm] = useState(false);
  // Painel do editor em fade ao trocar de nota (evita flash do conteúdo anterior).
  const [editorVisivel, setEditorVisivel] = useState(true);
  const [excluirArmado, setExcluirArmado] = useState(false);
  // ref com o id "carregado no momento" pra autosave/troca nunca gravar na nota errada.
  const idCarregadoRef = useRef<string | null>(null);
  const trocaTimerRef = useRef<number | null>(null);

  const [toast, setToast] = useState<{ msg: string; notaId: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["notas", userId] });
  };

  // Troca de nota selecionada: fade out -> troca conteúdo -> fade in.
  function selecionar(id: string | null) {
    if (id === selectedId) return;
    setExcluirArmado(false);
    if (trocaTimerRef.current) window.clearTimeout(trocaTimerRef.current);
    if (reduceMotion) {
      const n = notas.find((x) => x.id === id);
      idCarregadoRef.current = id;
      setSelectedId(id);
      setTitulo(n?.titulo ?? "");
      setConteudo(n?.conteudo ?? "");
      setEditorVisivel(true);
      return;
    }
    setEditorVisivel(false);
    trocaTimerRef.current = window.setTimeout(() => {
      const n = notas.find((x) => x.id === id);
      idCarregadoRef.current = id;
      setSelectedId(id);
      setTitulo(n?.titulo ?? "");
      setConteudo(n?.conteudo ?? "");
      setEditorVisivel(true);
    }, 200);
  }

  useEffect(() => {
    return () => {
      if (trocaTimerRef.current) window.clearTimeout(trocaTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const salvar = useMutation({
    mutationFn: async ({ id, t, c }: { id: string; t: string; c: string }) => {
      const { error } = await supabase
        .from("notas")
        .update({ titulo: t, conteudo: c })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onError: () => toastErro("Não consegui salvar a nota. O texto ainda está na tela."),
    onSuccess: (id) => {
      // Só reflete "salvo" se ainda estivermos na mesma nota (evita closure obsoleta).
      if (idCarregadoRef.current === id) {
        setSalvoEm(true);
        window.setTimeout(() => {
          if (idCarregadoRef.current === id) setSalvoEm(false);
        }, 1500);
      }
      invalidar();
    },
  });

  // Autosave com debounce — só salva se houve mudança real, e sempre na nota que
  // estava carregada no momento em que o timer disparar (evita gravar na nota errada
  // ao alternar rapidamente entre notas).
  useEffect(() => {
    if (!selectedId) return;
    const idNoMomento = selectedId;
    const n = notas.find((x) => x.id === idNoMomento);
    if (!n) return;
    if (idsExcedentes.has(idNoMomento)) return;
    if (n.titulo === titulo && n.conteudo === conteudo) return;
    const t = window.setTimeout(() => {
      if (idCarregadoRef.current !== idNoMomento) return;
      salvar.mutate({ id: idNoMomento, t: titulo, c: conteudo });
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, conteudo, selectedId]);

  const criar = useMutation({
    mutationFn: async (tituloInicial?: string) => {
      const t = tituloInicial ?? "";
      const { data, error } = await supabase
        .from("notas")
        .insert({ user_id: userId!, titulo: t, conteudo: "" })
        .select("id")
        .single();
      if (error) throw error;
      return { id: data?.id as string | undefined, titulo: t };
    },
    onError: () => toastErro("Não consegui criar a nota. Tenta de novo."),
    onSuccess: ({ id, titulo: tituloCriado }) => {
      track("nota_criada");
      invalidar();
      if (!id) return;
      // Abre a nota recém-criada direto, sem esperar o refetch da lista
      // (o conteúdo já é conhecido aqui, então não há closure obsoleta).
      if (trocaTimerRef.current) window.clearTimeout(trocaTimerRef.current);
      idCarregadoRef.current = id;
      setSelectedId(id);
      setTitulo(tituloCriado);
      setConteudo("");
      setEditorVisivel(true);
      setExcluirArmado(false);
    },
  });

  const fixar = useMutation({
    mutationFn: async (n: Nota) => {
      const { error } = await supabase.from("notas").update({ fixada: !n.fixada }).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: () => toastErro("Não consegui fixar a nota. Tenta de novo."),
  });

  // Exclusão com soft delete (mantém deleted_at) + toast de 6s com desfazer.
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onError: () => toastErro("Não consegui excluir a nota. Tenta de novo."),
    onSuccess: (id) => {
      invalidar();
      const nota = notas.find((n) => n.id === id);
      setSelectedId(null);
      idCarregadoRef.current = null;
      setExcluirArmado(false);
      mostrarToast(`Nota excluída: ${nota?.titulo.trim() || "sem título"}`, id);
    },
  });

  const desfazer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notas").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: () => toastErro("Não consegui restaurar a nota. Tenta de novo."),
  });

  function mostrarToast(msg: string, notaId: string) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ msg, notaId });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 6000);
  }

  function handleExcluirClick() {
    if (!selecionada) return;
    if (!excluirArmado) {
      setExcluirArmado(true);
      return;
    }
    remover.mutate(selecionada.id);
  }

  function handleDesfazer() {
    if (!toast) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    desfazer.mutate(toast.notaId);
    setToast(null);
  }

  function criarDeBusca() {
    const termo = busca.trim();
    criar.mutate(termo);
    setBusca("");
  }

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav navActive="/caderno" />

      <main className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              Caderno
            </p>
            <h1 className="font-cabinet mt-1 text-[clamp(28px,5vw,42px)] leading-[1.08] text-[var(--ink)]">
              Suas anotações.
            </h1>
            <p className="mt-2 italic text-[var(--ink-soft)]">
              Suas ideias, anotações e rascunhos · num lugar só.
            </p>
          </div>
          <button
            type="button"
            onClick={() => criar.mutate(undefined)}
            disabled={criar.isPending || cotaAtingida}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--secondary)] px-4 py-2.5 font-medium text-[var(--secondary-ink)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Nova nota</span>
          </button>
        </div>

        {cotaAtingida && (
          <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
            No Confere você tem 1 nota. Suba pro Controle pra deixar ilimitado.{" "}
            <Link
              to="/upgrade"
              search={{ rota: "/caderno", tier: "controle" }}
              className="font-medium text-[var(--secondary-text)] no-underline"
            >
              Assinar o Controle
            </Link>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
          {/* Lista (esquerda) */}
          <aside className={selectedId ? "hidden lg:block" : "block"}>
            {/* Busca */}
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar anotações…"
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-white pl-9 pr-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
                />
              </div>
            </div>

            {notasQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[var(--surface)]" />
                ))}
              </div>
            ) : notas.length === 0 ? (
              <ListaVazia onCriar={() => criar.mutate(undefined)} />
            ) : notasVisiveis.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-8 text-center text-[13px] text-[var(--muted)]">
                Nada com esse termo.{" "}
                <button
                  type="button"
                  onClick={criarDeBusca}
                  className="font-medium text-[var(--secondary-text)] hover:underline"
                >
                  Criar nota &quot;{busca.trim()}&quot;
                </button>
              </p>
            ) : (
              <ul className="space-y-3">
                {notasVisiveis.map((n) => {
                  const ativa = selectedId === n.id;
                  const termo = busca.trim();
                  const preview = [n.conteudo.split("\n")[0] ?? "", n.conteudo.split("\n")[1] ?? ""]
                    .join(" ")
                    .trim();
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => selecionar(n.id)}
                        className={`block w-full rounded-xl border bg-white p-4 text-left transition-colors ${
                          ativa
                            ? "border-[var(--secondary)]"
                            : "border-[var(--line)] hover:border-[var(--secondary)]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fixar.mutate(n);
                            }}
                            aria-label={n.fixada ? "Desafixar" : "Fixar no topo"}
                            title={n.fixada ? "Desafixar" : "Fixar no topo"}
                            className={`mt-0.5 shrink-0 ${
                              n.fixada ? "text-[var(--secondary-text)]" : "text-[var(--muted)]"
                            }`}
                          >
                            <Pin
                              size={13}
                              aria-hidden="true"
                              fill={n.fixada ? "currentColor" : "none"}
                            />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-[16px] text-[var(--ink)]">
                              {destacar(n.titulo.trim() || "sem título", termo)}
                              {idsExcedentes.has(n.id) && (
                                <Lock
                                  size={12}
                                  className="shrink-0 text-[var(--muted)]"
                                  aria-hidden="true"
                                />
                              )}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--muted)]">
                              {idsExcedentes.has(n.id)
                                ? "somente leitura · acima da cota do Confere"
                                : preview
                                  ? destacar(preview, termo)
                                  : "nota vazia"}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Editor (direita) */}
          <section className={selectedId ? "block" : "hidden lg:block"}>
            {selecionada ? (
              <div
                className="rounded-xl border border-[var(--line)] bg-white p-5 transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-7"
                style={{ opacity: editorVisivel ? 1 : 0 }}
              >
                {/* Barra do editor */}
                <div className="mb-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => selecionar(null)}
                    className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--ink)] lg:hidden"
                  >
                    <ArrowLeft size={15} aria-hidden="true" /> voltar
                  </button>
                  <span
                    className={`ml-auto text-[13px] text-[var(--secondary-text)] transition-opacity ${
                      salvar.isPending ? "opacity-100" : salvoEm ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {salvar.isPending ? "salvando..." : "salvo"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fixar.mutate(selecionada)}
                      disabled={notaExcedente}
                      aria-label={selecionada.fixada ? "Desafixar" : "Fixar no topo"}
                      title={selecionada.fixada ? "Desafixar" : "Fixar no topo"}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40 ${
                        selecionada.fixada ? "text-[var(--secondary-text)]" : "text-[var(--muted)]"
                      }`}
                    >
                      <Pin
                        size={16}
                        aria-hidden="true"
                        fill={selecionada.fixada ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                </div>

                {notaExcedente && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink-soft)]">
                    <Lock size={14} className="shrink-0" aria-hidden="true" />
                    Somente leitura · essa nota está acima da cota do Confere.{" "}
                    <Link
                      to="/upgrade"
                      search={{ rota: "/caderno", tier: "controle" }}
                      className="font-medium text-[var(--secondary-text)] no-underline"
                    >
                      Assinar o Controle
                    </Link>
                  </div>
                )}

                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={160}
                  placeholder="Título da nota"
                  readOnly={notaExcedente}
                  className="mb-3 w-full bg-transparent text-[26px] leading-tight text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                />
                <textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Comece a escrever…"
                  readOnly={notaExcedente}
                  className="min-h-[48vh] w-full resize-none bg-transparent text-[15.5px] leading-[1.85] text-[var(--ink-soft)] placeholder:text-[var(--muted)] focus:outline-none"
                />

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleExcluirClick}
                    className="rounded-lg px-2 py-2 text-[13px] text-[var(--danger)] hover:underline"
                  >
                    {excluirArmado ? "Excluir mesmo? Clique de novo" : "Excluir nota"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="hidden h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-white px-6 text-center lg:flex">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)]">
                  <NotebookPen
                    size={22}
                    aria-hidden="true"
                    className="text-[var(--secondary-text)]"
                  />
                </div>
                <p className="text-[14px] text-[var(--muted)]">
                  Escolha uma nota à esquerda ou crie uma nova.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Toast de exclusão com desfazer (rede de segurança de 6s) */}
      <div
        className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-[var(--line)] bg-white px-5 py-3 text-[14px] shadow-[0_4px_12px_rgba(10,10,10,0.08)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        <span>{toast?.msg}</span>
        <button
          type="button"
          onClick={handleDesfazer}
          className="font-semibold text-[var(--secondary-text)] underline underline-offset-2"
        >
          Desfazer
        </button>
      </div>
    </div>
  );
}

function ListaVazia({ onCriar }: { onCriar: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)]">
        <NotebookPen size={22} aria-hidden="true" className="text-[var(--secondary-text)]" />
      </div>
      <p className="mb-3 text-[14px] leading-relaxed text-[var(--muted)]">
        Seu caderno está em branco. A primeira página é sua.
      </p>
      <button
        type="button"
        onClick={onCriar}
        className="text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
      >
        + criar a primeira nota
      </button>
      <p className="mt-3 text-[12px] text-[var(--muted)]">
        ou monte seu guia de presença pelo{" "}
        <a
          href="/planejamento/modulo/5"
          className="font-medium text-[var(--secondary-text)] hover:underline"
        >
          Planejamento →
        </a>
      </p>
    </div>
  );
}
