import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Check, ChevronDown, CalendarDays, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BTN_ACAO } from "@/lib/botoes";
import { track } from "@/lib/analytics";

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

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas · Pólia" },
      { name: "description", content: "Onde a marca quer chegar, e o quanto já andou." },
    ],
  }),
  component: MetasPage,
});

type Formato = "numero" | "moeda";

interface Meta {
  id: string;
  titulo: string;
  status: string;
  valor_atual: number;
  valor_alvo: number | null;
  unidade: string | null;
  formato: string;
  prazo: string | null;
  concluida_em: string | null;
  created_at: string;
}

const LIMITE_ATIVAS = 3;

/* ───────── helpers ───────── */
function num(s: string) {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function valorFmt(formato: string, v: number) {
  const n = v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return formato === "moeda" ? `R$ ${n}` : n;
}

function sufixoUnidade(m: Meta) {
  return m.formato === "numero" && m.unidade?.trim() ? ` ${m.unidade.trim()}` : "";
}

function progressoPct(m: Meta) {
  const alvo = m.valor_alvo ?? 0;
  if (alvo <= 0) return 0;
  return Math.min(100, Math.round((m.valor_atual / alvo) * 100));
}

function hojeISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function prazoCurto(prazo: string) {
  const d = new Date(prazo + "T00:00:00");
  if (Number.isNaN(d.getTime())) return prazo;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function dataLonga(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

/* ============== Página ============== */
function MetasPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();

  const [modalAberto, setModalAberto] = useState(false);
  const [metaEdit, setMetaEdit] = useState<Meta | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; titulo: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const metasQuery = useQuery({
    queryKey: ["metas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select(
          "id, titulo, status, valor_atual, valor_alvo, unidade, formato, prazo, concluida_em, created_at",
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Meta[];
    },
  });

  const metas = metasQuery.data ?? [];
  const ativas = metas.filter((m) => m.status === "ativa");
  const concluidas = metas.filter((m) => m.status === "concluida");
  const limiteAtingido = ativas.length >= LIMITE_ATIVAS;

  const invalidar = () => qc.invalidateQueries({ queryKey: ["metas", userId] });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"metas"> }) => {
      const { error } = await supabase
        .from("metas")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setErroAcao(null);
      invalidar();
    },
    onError: (e: unknown) => {
      // O erro do banco vem em inglês técnico: fica no log, não na tela.
      console.error("meta_salvar", e);
      setErroAcao("Não conseguimos salvar a meta agora. Tenta de novo.");
    },
  });

  const concluir = (m: Meta) => {
    track("meta_concluida");
    atualizar.mutate({
      id: m.id,
      patch: {
        status: "concluida",
        concluida_em: new Date().toISOString(),
        progresso: 100,
        ...(m.valor_alvo != null ? { valor_atual: m.valor_alvo } : {}),
      },
    });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: m.id, titulo: m.titulo });
    toastTimerRef.current = setTimeout(() => setToast(null), 6000);
  };

  const desfazerConclusao = () => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    atualizar.mutate({ id: toast.id, patch: { status: "ativa", concluida_em: null } });
    setToast(null);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const arquivar = (m: Meta) => {
    if (!window.confirm(`Arquivar "${m.titulo}"? Ela sai da sua lista de metas ativas.`)) return;
    atualizar.mutate({ id: m.id, patch: { status: "arquivada" } });
  };

  const reabrir = (m: Meta) => {
    if (limiteAtingido) return;
    atualizar.mutate({ id: m.id, patch: { status: "ativa", concluida_em: null } });
  };

  const abrirCriar = () => {
    if (limiteAtingido) return;
    setMetaEdit(null);
    setModalAberto(true);
  };

  const abrirEditar = (m: Meta) => {
    setMetaEdit(m);
    setModalAberto(true);
  };

  return (
    <PaginaLogada
      largura="larga"
      eyebrow="Suas metas"
      titulo="Onde a marca quer chegar."
      subtitulo={`Até ${LIMITE_ATIVAS} metas ativas por vez, pra o foco não se dividir.`}
      acao={
        <button
          onClick={abrirCriar}
          disabled={limiteAtingido}
          title={
            limiteAtingido ? "Conclua ou arquive uma meta antes de adicionar outra." : undefined
          }
          className={BTN_ACAO}
        >
          <Plus size={16} aria-hidden="true" /> Nova meta
        </button>
      }
    >
      <div>
        {limiteAtingido && (
          <p className="mb-4 text-[12px] text-[var(--muted)]">
            Já tem {LIMITE_ATIVAS} metas ativas aqui. Conclua ou arquive uma antes de adicionar
            outra.
          </p>
        )}

        {erroAcao && <p className="mt-4 text-[13px] text-[var(--danger)]">{erroAcao}</p>}

        {/* ───────── Lista de metas ativas ───────── */}
        <section className="mt-8">
          {metasQuery.isLoading ? (
            <p className="py-12 text-center text-[14px] text-[var(--muted)]">
              Carregando suas metas…
            </p>
          ) : metasQuery.isError ? (
            <p className="py-12 text-center text-[14px] text-[var(--danger)]">
              Não foi possível carregar suas metas. Recarregue a página.
            </p>
          ) : ativas.length === 0 ? (
            <Vazio
              icone={Target}
              titulo="Nenhuma meta ainda."
              texto={`Defina até ${LIMITE_ATIVAS} para manter o foco no que importa.`}
              acao={
                <a href="/planejamento/modulo/6" className={BTN_ACAO}>
                  Definir pelo Planejamento
                  <span aria-hidden="true">→</span>
                </a>
              }
            />
          ) : (
            <ul className="space-y-3">
              {ativas.map((m) => (
                <MetaCard
                  key={m.id}
                  meta={m}
                  onEditar={() => abrirEditar(m)}
                  onArquivar={() => arquivar(m)}
                  onConcluir={() => concluir(m)}
                  onSalvarTitulo={(titulo) => atualizar.mutate({ id: m.id, patch: { titulo } })}
                  onSalvarAtual={(valor_atual) =>
                    atualizar.mutate({ id: m.id, patch: { valor_atual } })
                  }
                />
              ))}
            </ul>
          )}
        </section>

        {/* ───────── Concluídas (colapsável) ───────── */}
        {concluidas.length > 0 && (
          <section className="mt-10 border-t border-[var(--line)] pt-6">
            <button
              onClick={() => setVerConcluidas((v) => !v)}
              aria-expanded={verConcluidas}
              className="inline-flex items-center gap-1.5 text-[14px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform ${verConcluidas ? "rotate-180" : ""}`}
              />
              Ver concluídas ({concluidas.length})
            </button>
            {verConcluidas && (
              <ConcluidasLista>
                {concluidas.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-[var(--ink)]">{m.titulo}</p>
                      {m.concluida_em && (
                        <p className="text-[12px] text-[var(--muted)]">
                          concluída em {dataLonga(m.concluida_em)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => reabrir(m)}
                      disabled={limiteAtingido}
                      title={
                        limiteAtingido
                          ? "Já tem 3 metas ativas. Conclua ou arquive uma antes de reabrir."
                          : undefined
                      }
                      className="shrink-0 text-[13px] text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
                    >
                      Reabrir
                    </button>
                  </li>
                ))}
              </ConcluidasLista>
            )}
          </section>
        )}
      </div>

      {/* ───────── Modal ───────── */}
      {modalAberto && userId && (
        <ModalMeta
          userId={userId}
          metaEdit={metaEdit}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            invalidar();
            setModalAberto(false);
          }}
        />
      )}

      {/* ───────── Toast: meta concluída ───────── */}
      <div
        className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-[var(--line)] bg-white px-5 py-3 text-[14px] text-[var(--ink)] shadow-[0_4px_12px_rgba(10,10,10,0.08)] transition-opacity duration-[220ms] ${
          toast ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        <span>Meta concluída: {toast?.titulo}</span>
        <button
          onClick={desfazerConclusao}
          className="font-semibold text-[var(--secondary-text)] underline underline-offset-2 hover:opacity-80"
        >
          Desfazer
        </button>
      </div>
    </PaginaLogada>
  );
}

/* ============== Lista de concluídas (transição de entrada) ============== */
function ConcluidasLista({ children }: { children: ReactNode }) {
  const reduceMotion = usePrefersReducedMotion();
  const [entrou, setEntrou] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setEntrou(true);
      return;
    }
    setEntrou(false);
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntrou(true)));
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  return (
    <ul
      className="mt-4 space-y-2 transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        opacity: entrou ? 1 : 0,
        transform: entrou ? "translateY(0)" : "translateY(10px)",
      }}
    >
      {children}
    </ul>
  );
}

/* ============== Card de meta ativa ============== */
function MetaCard({
  meta,
  onEditar,
  onArquivar,
  onConcluir,
  onSalvarTitulo,
  onSalvarAtual,
}: {
  meta: Meta;
  onEditar: () => void;
  onArquivar: () => void;
  onConcluir: () => void;
  onSalvarTitulo: (titulo: string) => void;
  onSalvarAtual: (valor: number) => void;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [armada, setArmada] = useState(false);
  const pct = progressoPct(meta);
  const pronta = pct >= 100;
  const alvo = meta.valor_alvo ?? 0;
  const vencido = !!meta.prazo && meta.prazo < hojeISODate();

  const clicarConcluir = () => {
    if (!pronta && !armada) {
      setArmada(true);
      return;
    }
    setArmada(false);
    onConcluir();
  };

  return (
    <li
      className={`relative rounded-xl border bg-white p-4 ${
        pronta ? "border-[var(--secondary)]" : "border-[var(--line)]"
      }`}
    >
      {/* Título + menu */}
      <div className="flex items-start justify-between gap-3">
        <InlineTitle titulo={meta.titulo} onCommit={onSalvarTitulo} />
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Opções da meta"
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
          {menuAberto && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuAberto(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-[var(--line)] bg-white py-1 shadow-sm">
                <button
                  onClick={() => {
                    setMenuAberto(false);
                    onEditar();
                  }}
                  className="block w-full px-3 py-2 text-left text-[14px] text-[var(--ink)] hover:bg-[var(--surface)]"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    setMenuAberto(false);
                    onArquivar();
                  }}
                  className="block w-full px-3 py-2 text-left text-[14px] text-[var(--danger)] hover:bg-[var(--surface)]"
                >
                  Arquivar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progresso atual / alvo */}
      <div className="mt-3">
        <p className="text-[14px] text-[var(--ink-soft)]">
          <InlineValor value={meta.valor_atual} formato={meta.formato} onCommit={onSalvarAtual} />
          <span className="text-[var(--muted)]"> de </span>
          <span className="font-medium text-[var(--ink)]">
            {valorFmt(meta.formato, alvo)}
            {sufixoUnidade(meta)}
          </span>
        </p>

        {/* Barra fina */}
        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[var(--secondary)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-[12px] font-medium text-[var(--muted)]">
            {pct}%
          </span>
        </div>
      </div>

      {/* Rodapé: prazo + concluir */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {pronta ? (
            <span className="text-[12px] font-medium text-[var(--secondary-text)]">
              Meta batida.
            </span>
          ) : meta.prazo ? (
            <span
              className={`inline-flex items-center gap-1 text-[12px] ${
                vencido ? "text-[var(--danger)]" : "text-[var(--muted)]"
              }`}
            >
              <CalendarDays size={12} aria-hidden="true" />
              {vencido ? "venceu" : "até"} {prazoCurto(meta.prazo)}
            </span>
          ) : null}
        </div>
        <button
          onClick={clicarConcluir}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
            pronta
              ? "bg-[var(--secondary)] text-[var(--secondary-ink)] hover:opacity-90"
              : armada
                ? "border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                : "border border-[var(--secondary)] text-[var(--secondary-text)] hover:bg-[var(--secondary-light)]"
          }`}
        >
          <Check size={15} aria-hidden="true" />
          {armada ? `Concluir mesmo com ${pct}%?` : "Concluir"}
        </button>
      </div>
    </li>
  );
}

/* ============== Título editável inline ============== */
function InlineTitle({ titulo, onCommit }: { titulo: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(titulo);

  const start = () => {
    setDraft(titulo);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== titulo) onCommit(v);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="min-w-0 flex-1 rounded-md border border-[var(--secondary)] px-2 py-1 text-[17px] text-[var(--ink)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Editar título da meta"
      className="min-w-0 flex-1 text-left text-[17px] leading-snug text-[var(--ink)] hover:text-[var(--secondary-text)]"
    >
      {titulo}
    </button>
  );
}

/* ============== Valor atual editável inline ============== */
function InlineValor({
  value,
  formato,
  onCommit,
}: {
  value: number;
  formato: string;
  onCommit: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const start = () => {
    setDraft(value ? String(value) : "");
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const v = num(draft);
    if (v !== value) onCommit(v);
  };

  if (editing) {
    return (
      <input
        type="number"
        inputMode="decimal"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-24 rounded-md border border-[var(--secondary)] px-2 py-0.5 text-[14px] font-medium text-[var(--ink)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Atualizar valor atual da meta"
      className="font-medium text-[var(--ink)] underline decoration-dotted decoration-[var(--muted)] underline-offset-2 hover:decoration-[var(--secondary)]"
    >
      {valorFmt(formato, value)}
    </button>
  );
}

/* ============== Modal: criar / editar meta ============== */
function ModalMeta({
  userId,
  metaEdit,
  onClose,
  onSaved,
}: {
  userId: string;
  metaEdit: Meta | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!metaEdit;

  const [titulo, setTitulo] = useState(metaEdit?.titulo ?? "");
  const [formato, setFormato] = useState<Formato>((metaEdit?.formato as Formato) ?? "numero");
  const [unidade, setUnidade] = useState(metaEdit?.unidade ?? "");
  const [alvo, setAlvo] = useState(metaEdit?.valor_alvo != null ? String(metaEdit.valor_alvo) : "");
  const [atual, setAtual] = useState(
    metaEdit?.valor_atual != null ? String(metaEdit.valor_atual) : "",
  );
  const [prazo, setPrazo] = useState(metaEdit?.prazo ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alvoNum = num(alvo);
  const podeSalvar = titulo.trim().length > 0 && alvoNum > 0;

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);

    const base = {
      titulo: titulo.trim(),
      formato,
      unidade: formato === "numero" && unidade.trim() ? unidade.trim() : null,
      valor_alvo: alvoNum,
      valor_atual: atual.trim() ? num(atual) : 0,
      prazo: prazo || null,
    };

    if (edit && metaEdit) {
      const { error } = await supabase
        .from("metas")
        .update({ ...base, updated_at: new Date().toISOString() })
        .eq("id", metaEdit.id);
      setSalvando(false);
      if (error) {
        setErro(error.message || "Erro ao salvar.");
        return;
      }
    } else {
      const { error } = await supabase.from("metas").insert({ user_id: userId, ...base });
      setSalvando(false);
      if (error) {
        setErro(error.message || "Erro ao salvar.");
        return;
      }
      track("meta_criada", { formato });
    }
    onSaved();
  };

  return (
    <div
      className="polia-v3 fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/50 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-[24px] text-[var(--ink)]">{edit ? "Editar meta" : "Nova meta"}</h2>

        {/* Título */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Meta</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            autoFocus
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="ex: chegar a 30 clientes fixas"
          />
        </div>

        {/* Formato */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Formato da medida</label>
          <div className="flex gap-2">
            {(
              [
                { id: "numero", label: "Quantidade" },
                { id: "moeda", label: "Dinheiro (R$)" },
              ] as { id: Formato; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFormato(f.id)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] ${
                  formato === f.id
                    ? "border-[var(--secondary)] bg-[var(--secondary-light)] text-[var(--secondary-text)]"
                    : "border-[var(--line)] text-[var(--ink-soft)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alvo + (unidade) */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] text-[var(--muted)]">
              {formato === "moeda" ? "Meta (R$)" : "Meta (quanto alcançar)"}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={alvo}
              onChange={(e) => setAlvo(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
              placeholder="0"
            />
          </div>
          {formato === "numero" && (
            <div>
              <label className="mb-1 block text-[12px] text-[var(--muted)]">Unidade</label>
              <input
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                maxLength={24}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
                placeholder="clientes, vendas…"
              />
            </div>
          )}
        </div>

        {/* Atual */}
        <div className="mb-4">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">Valor atual, hoje</label>
          <input
            type="number"
            inputMode="decimal"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
            placeholder="0"
          />
        </div>

        {/* Prazo */}
        <div className="mb-6">
          <label className="mb-1 block text-[12px] text-[var(--muted)]">
            Data alvo <span className="text-[var(--muted)]">(opcional)</span>
          </label>
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary)] focus:shadow-[0_0_0_3px_var(--secondary-light)] focus:outline-none"
          />
        </div>

        {erro && <p className="mb-3 text-[13px] text-[var(--danger)]">{erro}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !podeSalvar}
            className="rounded-xl bg-[var(--secondary)] px-5 py-2 text-[14px] font-medium text-[var(--secondary-ink)] hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : edit ? "Salvar" : "Criar meta"}
          </button>
        </div>
      </div>
    </div>
  );
}
