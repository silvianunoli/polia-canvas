import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastInfo, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { Plus, Pin, Trash2, ArrowLeft, NotebookPen, Search, Lock } from "lucide-react";
import { COTAS_CONFERE } from "@/lib/planos";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

export const Route = createFileRoute("/_authenticated/caderno")({
  head: () => ({
    meta: [
      { title: "Caderno · Pólia One" },
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

  // Cota do plano Grátis: 1 nota ativa. As mais antigas por created_at ficam
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

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["notas", userId] });
  };

  // Preenchida logo abaixo de `salvar` (ver QA-18 lá).
  const gravarPendenteRef = useRef<() => void>(() => {});
  // Último conteúdo gravado com sucesso, pra não regravar o mesmo texto
  // enquanto a lista ainda não recarregou.
  const ultimoSalvoRef = useRef<{ id: string; t: string; c: string } | null>(null);

  // Troca de nota selecionada: fade out -> troca conteúdo -> fade in.
  function selecionar(id: string | null) {
    if (id === selectedId) return;
    gravarPendenteRef.current();
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
    };
  }, []);

  const salvar = useMutation({
    mutationFn: async ({ id, t, c }: { id: string; t: string; c: string }) => {
      const { error } = await supabase
        .from("notas")
        .update({ titulo: t, conteudo: c })
        .eq("id", id);
      if (error) throw error;
      ultimoSalvoRef.current = { id, t, c };
      return id;
    },
    onError: () =>
      toastErro("A Pólia One não conseguiu salvar a nota. O texto ainda está na tela."),
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

  // QA-18 (08/10/2026): o debounce acima é cancelado quando a nota aberta
  // muda ou a tela desmonta, e o que tinha sido digitado nos últimos 0,8 s
  // sumia. Antes de largar a nota (trocar, voltar, sair da tela), o que estiver
  // pendente é gravado na hora. A ref é refeita a cada render pra a
  // desmontagem enxergar o texto atual, não o do primeiro render.
  gravarPendenteRef.current = () => {
    const id = idCarregadoRef.current;
    if (!id || idsExcedentes.has(id)) return;
    const n = notas.find((x) => x.id === id);
    if (!n || (n.titulo === titulo && n.conteudo === conteudo)) return;
    const u = ultimoSalvoRef.current;
    if (u && u.id === id && u.t === titulo && u.c === conteudo) return;
    salvar.mutate({ id, t: titulo, c: conteudo });
  };
  useEffect(() => {
    return () => gravarPendenteRef.current();
  }, []);

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
    onError: () => toastErro("A Pólia One não conseguiu criar a nota. Tenta de novo."),
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
    onError: () => toastErro("A Pólia One não conseguiu fixar a nota. Tenta de novo."),
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
    onError: () => toastErro("A Pólia One não conseguiu excluir a nota. Tenta de novo."),
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
    onError: () => toastErro("A Pólia One não conseguiu restaurar a nota. Tenta de novo."),
  });

  function mostrarToast(msg: string, notaId: string) {
    toastInfo(msg, {
      duracaoMs: 6000,
      action: { label: "Desfazer", onClick: () => desfazer.mutate(notaId) },
    });
  }

  function handleExcluirClick() {
    if (!selecionada) return;
    if (!excluirArmado) {
      setExcluirArmado(true);
      return;
    }
    remover.mutate(selecionada.id);
  }

  // "Salvar e fechar": grava agora o que estiver pendente do autosave (mesma
  // mutation, sem mexer no debounce de digitação) e só fecha se a gravação deu
  // certo. Se falhar, o onError de `salvar` já avisa e o editor fica aberto com
  // o texto na tela. Durante a gravação os campos ficam só leitura, senão o que
  // fosse digitado depois do clique sumiria junto com o editor.
  const [fechando, setFechando] = useState(false);
  async function salvarEFechar() {
    if (!selecionada || fechando) return;
    const id = selecionada.id;
    if (notaExcedente) {
      selecionar(null);
      return;
    }
    const mudou = selecionada.titulo !== titulo || selecionada.conteudo !== conteudo;
    setFechando(true);
    try {
      if (mudou) {
        await salvar.mutateAsync({ id, t: titulo, c: conteudo });
      }
    } catch {
      setFechando(false);
      return;
    }
    setFechando(false);
    // Ela pode ter trocado de nota enquanto gravava: aí não fecha a outra.
    if (idCarregadoRef.current !== id) return;
    toastSucesso("Nota salva.");
    selecionar(null);
  }

  // QA-18: o botão "Criar nota" da busca vazia ignorava a cota do plano
  // Grátis; o banco recusava e o erro dizia "tenta de novo", o que não ia
  // adiantar. Agora respeita a mesma trava do botão "Nova nota".
  function criarDeBusca() {
    if (cotaAtingida || criar.isPending) return;
    const termo = busca.trim().slice(0, 160);
    criar.mutate(termo);
    setBusca("");
  }

  return (
    <PaginaLogada
      dica="caderno"
      largura="larga"
      eyebrow="Caderno"
      titulo="Suas anotações."
      subtitulo="Suas ideias, anotações e rascunhos num lugar só."
      acao={
        <button
          type="button"
          onClick={() => criar.mutate(undefined)}
          disabled={criar.isPending || cotaAtingida}
          aria-label="Nova nota"
          className={BTN_ACAO}
        >
          <Plus size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Nova nota</span>
        </button>
      }
    >
      <div>
        {cotaAtingida && (
          <div className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px] text-[var(--ink-soft)]">
            No plano Grátis cabe 1 nota. Suba pro Premium pra deixar ilimitado.{" "}
            <Link
              to="/upgrade"
              search={{ rota: "/caderno", tier: "controle" }}
              className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
            >
              Assinar o Premium
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
                  aria-label="Buscar anotações"
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-white pl-9 pr-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--secondary-text)] focus:outline-none"
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
              <Vazio
                denso
                icone={NotebookPen}
                titulo="Nenhuma nota por aqui ainda."
                texto="O caderno guarda ideia solta, rascunho de legenda e o que não pode escapar."
                acao={
                  <>
                    <button
                      type="button"
                      onClick={() => criar.mutate(undefined)}
                      className={BTN_ACAO}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Criar a primeira nota
                    </button>
                    <p className="mt-3 text-[12px] text-[var(--muted)]">
                      ou monte seu guia de presença pelo{" "}
                      <LinkInterno
                        href="/planejamento/modulo/5"
                        className="font-medium text-[var(--secondary-text)] hover:underline"
                      >
                        Planejamento →
                      </LinkInterno>
                    </p>
                  </>
                }
              />
            ) : notasVisiveis.length === 0 ? (
              <Vazio
                denso
                icone={Search}
                titulo="Nada com esse termo."
                texto="Nenhuma nota tem essa palavra no título nem no corpo."
                acao={
                  cotaAtingida ? (
                    <p className="text-[12px] text-[var(--muted)]">
                      No plano Grátis cabe 1 nota, e ela já existe.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={criarDeBusca}
                      disabled={criar.isPending}
                      className={BTN_ACAO}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Criar nota &quot;{busca.trim()}&quot;
                    </button>
                  )
                }
              />
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
                      {/* Fixar e abrir são dois botões irmãos (ONE-69): antes o pino ficava dentro
                          do card role="button", interativo dentro de interativo. O ::after do botão
                          de abrir cobre o card inteiro, então clicar em qualquer ponto continua
                          abrindo a nota; o pino fica por cima com z-10. */}
                      <div
                        className={`relative flex items-start gap-2 rounded-xl border bg-white p-4 transition-colors ${
                          ativa
                            ? "border-[var(--secondary)]"
                            : "border-[var(--line)] hover:border-[var(--secondary)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => fixar.mutate(n)}
                          aria-label={n.fixada ? "Desafixar" : "Fixar no topo"}
                          title={n.fixada ? "Desafixar" : "Fixar no topo"}
                          className={`relative z-10 mt-0.5 shrink-0 before:absolute before:-inset-[14px] before:content-[''] ${
                            n.fixada ? "text-[var(--secondary-text)]" : "text-[var(--muted)]"
                          }`}
                        >
                          <Pin
                            size={13}
                            aria-hidden="true"
                            fill={n.fixada ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => selecionar(n.id)}
                          aria-pressed={ativa}
                          className="min-w-0 flex-1 cursor-pointer text-left after:absolute after:inset-0 after:rounded-xl after:content-['']"
                        >
                          <span className="flex items-center gap-1.5 truncate text-[16px] text-[var(--ink)]">
                            {destacar(n.titulo.trim() || "sem título", termo)}
                            {idsExcedentes.has(n.id) && (
                              <Lock
                                size={12}
                                className="shrink-0 text-[var(--muted)]"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-[var(--muted)]">
                            {idsExcedentes.has(n.id)
                              ? "somente leitura · acima da cota do plano Grátis"
                              : preview
                                ? destacar(preview, termo)
                                : "nota vazia"}
                          </span>
                        </button>
                      </div>
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
                    className="flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--ink)] lg:hidden"
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
                      className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40 ${
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
                    Somente leitura · essa nota está acima da cota do plano Grátis.{" "}
                    <Link
                      to="/upgrade"
                      search={{ rota: "/caderno", tier: "controle" }}
                      className="font-medium text-[var(--secondary-text)] no-underline hover:underline"
                    >
                      Assinar o Premium
                    </Link>
                  </div>
                )}

                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={160}
                  placeholder="Título da nota"
                  readOnly={notaExcedente || fechando}
                  className="mb-3 w-full bg-transparent text-[26px] leading-tight text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                />
                <textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Comece a escrever…"
                  readOnly={notaExcedente || fechando}
                  className="min-h-[48vh] w-full resize-none bg-transparent text-[15.5px] leading-[1.85] text-[var(--ink-soft)] placeholder:text-[var(--muted)] focus:outline-none"
                />

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleExcluirClick}
                    disabled={fechando}
                    className={`${BTN_MIUDO} !border-[var(--danger)] !text-[var(--danger)]`}
                  >
                    {excluirArmado ? "Confirmar exclusão" : "Excluir nota"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void salvarEFechar()}
                    disabled={fechando || remover.isPending}
                    className={BTN_ACAO}
                  >
                    {notaExcedente ? "Fechar" : fechando ? "Salvando..." : "Salvar e fechar"}
                  </button>
                </div>
                {/* Existe desfazer de alguns segundos: a copy mostra a rede. */}
                {excluirArmado && (
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    A nota sai da lista. Dá pra desfazer nos próximos segundos.
                  </p>
                )}
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
      </div>
    </PaginaLogada>
  );
}
