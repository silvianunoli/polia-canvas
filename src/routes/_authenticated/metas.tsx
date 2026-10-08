import { useEffect, useRef, useState, type ReactNode } from "react";
import { hojeISO } from "@/lib/data.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, ChevronDown, CalendarDays, Target, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { Campo } from "@/components/ui/Campo";
import { Modal } from "@/components/ui/Modal";
import { MenuOpcoes } from "@/components/ui/MenuOpcoes";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO } from "@/lib/botoes";
import { toastInfo } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { TITULO_META_DO_MES, metaDoMesConta } from "@/lib/metaDoMes";
import { progressoPct } from "@/lib/metas";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas · Pólia One" },
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
  progresso: number;
  da_jornada: boolean;
  created_at: string;
}

// Teto de metas ativas ao mesmo tempo. Vale pra TODO plano: é regra de foco,
// não cota de assinatura, por isso não mora em COTAS_CONFERE (ver a nota lá em
// src/lib/planos.ts). É também o "até 3 metas acompanhadas" que o card do
// Confere promete na landing (src/routes/index.tsx) — a rota abriu pro plano
// grátis em 03/09/2026 (COPY-03), este número é o que sustenta a promessa.
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

/** A Meta do mês é lida pelo título em 5 telas: renomear desliga todas (QA-19). */
function ehMetaDoMes(m: Pick<Meta, "titulo">) {
  return m.titulo === TITULO_META_DO_MES;
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
  const [metaArquivar, setMetaArquivar] = useState<Meta | null>(null);

  const metasQuery = useQuery({
    queryKey: ["metas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select(
          "id, titulo, status, valor_atual, valor_alvo, unidade, formato, prazo, concluida_em, progresso, da_jornada, created_at",
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
  // Arquivar tirava a meta da tela pra sempre: não havia onde ver nem reabrir (QA-32).
  const arquivadas = metas.filter((m) => m.status === "arquivada");
  const limiteAtingido = ativas.length >= LIMITE_ATIVAS;
  const [verArquivadas, setVerArquivadas] = useState(false);

  // Uma segunda "Meta do mês" valendo faria as 5 telas escolherem entre duas.
  const metaDoMesJaExiste = (idIgnorado?: string) =>
    metas.some((m) => m.id !== idIgnorado && ehMetaDoMes(m) && metaDoMesConta(m.status));

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
      setErroAcao("A Pólia One não conseguiu salvar a meta agora. Tenta de novo, nada se perdeu.");
    },
  });

  const concluir = (m: Meta) => {
    track("meta_concluida");
    void registrar("feature_completed", {
      feature: "metas",
      propriedades: { acao: "meta_concluida" },
    });
    atualizar.mutate({
      id: m.id,
      patch: {
        status: "concluida",
        concluida_em: new Date().toISOString(),
        progresso: 100,
        ...(m.valor_alvo != null ? { valor_atual: m.valor_alvo } : {}),
      },
    });
    toastInfo(`Meta concluída: ${m.titulo}`, {
      duracaoMs: 6000,
      action: {
        label: "Desfazer",
        // Desfazer devolve tudo o que concluir mudou (QA-32): antes voltava só
        // o status, e o valor atual ficava cravado no alvo.
        onClick: () => {
          const agora = qc.getQueryData<Meta[]>(["metas", userId]) ?? [];
          const outrasAtivas = agora.filter((x) => x.status === "ativa" && x.id !== m.id).length;
          if (outrasAtivas >= LIMITE_ATIVAS) {
            setErroAcao(
              `Já tem ${outrasAtivas} metas ativas. Conclua ou arquive uma antes de reabrir "${m.titulo}".`,
            );
            return;
          }
          atualizar.mutate({
            id: m.id,
            patch: {
              status: "ativa",
              concluida_em: null,
              valor_atual: m.valor_atual,
              progresso: m.progresso,
            },
          });
        },
      },
    });
  };

  const arquivar = (m: Meta) => {
    setMetaArquivar(m);
  };

  const confirmarArquivar = () => {
    if (!metaArquivar) return;
    atualizar.mutate({ id: metaArquivar.id, patch: { status: "arquivada" } });
    setMetaArquivar(null);
  };

  const reabrir = (m: Meta) => {
    if (limiteAtingido) return;
    // Arquivada não conta como Meta do mês; reabrir uma com outra já valendo
    // criaria duas.
    if (ehMetaDoMes(m) && m.status === "arquivada" && metaDoMesJaExiste(m.id)) {
      setErroAcao(
        "Já existe outra Meta do mês valendo. Arquive aquela antes de reabrir esta, pra os números não ficarem com duas.",
      );
      return;
    }
    atualizar.mutate({ id: m.id, patch: { status: "ativa", concluida_em: null } });
  };

  const salvarTitulo = (m: Meta, titulo: string) => {
    if (titulo === TITULO_META_DO_MES && metaDoMesJaExiste(m.id)) {
      setErroAcao("Já existe uma Meta do mês. Escolha outro nome pra esta meta.");
      return;
    }
    atualizar.mutate({ id: m.id, patch: { titulo } });
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
      dica="metas"
      largura="larga"
      eyebrow="Suas metas"
      titulo="Onde a marca quer chegar."
      subtitulo={`Até ${LIMITE_ATIVAS} metas ativas por vez, pra o foco não se dividir.`}
      acao={
        <button
          type="button"
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
        {/* A Meta do mês nasce do Planejamento mesmo com 3 ativas (a trigger
        não conhece o limite), então o número real pode passar de 3. */}
        {limiteAtingido && (
          <p className="mb-4 text-[12px] text-[var(--muted)]">
            {ativas.length > LIMITE_ATIVAS
              ? `Já tem ${ativas.length} metas ativas aqui, e o limite é ${LIMITE_ATIVAS}. Conclua ou arquive uma antes de adicionar outra.`
              : `Já tem ${LIMITE_ATIVAS} metas ativas aqui. Conclua ou arquive uma antes de adicionar outra.`}
          </p>
        )}

        {erroAcao && (
          <p role="alert" className="mt-4 text-[13px] text-[var(--danger)]">
            {erroAcao}
          </p>
        )}

        {/* ───────── Lista de metas ativas ───────── */}
        <section className="mt-8">
          {metasQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[88px] animate-pulse rounded-xl bg-[var(--surface)]" />
              ))}
            </div>
          ) : metasQuery.isError ? (
            <Vazio
              icone={AlertTriangle}
              titulo="A Pólia One não conseguiu carregar as suas metas."
              texto="Pode ter sido a conexão. Tenta de novo, nada do que já está salvo se perdeu."
              acao={
                <button
                  type="button"
                  onClick={() => void metasQuery.refetch()}
                  className={BTN_ACAO}
                >
                  Tentar de novo
                </button>
              }
            />
          ) : ativas.length === 0 ? (
            <Vazio
              icone={Target}
              titulo="Nenhuma meta ainda."
              texto={`Defina até ${LIMITE_ATIVAS} para manter o foco no que importa.`}
              acao={
                <LinkInterno href="/planejamento/modulo/6" className={BTN_ACAO}>
                  Definir pelo Planejamento
                  <span aria-hidden="true">→</span>
                </LinkInterno>
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
                  onSalvarTitulo={(titulo) => salvarTitulo(m, titulo)}
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
              type="button"
              onClick={() => setVerConcluidas((v) => !v)}
              aria-expanded={verConcluidas}
              className="-mx-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-[14px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
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
                      type="button"
                      onClick={() => reabrir(m)}
                      disabled={limiteAtingido}
                      title={
                        limiteAtingido
                          ? `Já tem ${ativas.length} metas ativas. Conclua ou arquive uma antes de reabrir.`
                          : undefined
                      }
                      className="inline-flex min-h-11 shrink-0 items-center text-[13px] text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
                    >
                      Reabrir
                    </button>
                  </li>
                ))}
              </ConcluidasLista>
            )}
          </section>
        )}

        {/* ───────── Arquivadas (colapsável) ───────── */}
        {arquivadas.length > 0 && (
          <section className="mt-6 border-t border-[var(--line)] pt-6">
            <button
              type="button"
              onClick={() => setVerArquivadas((v) => !v)}
              aria-expanded={verArquivadas}
              className="-mx-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-[14px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform ${verArquivadas ? "rotate-180" : ""}`}
              />
              Ver arquivadas ({arquivadas.length})
            </button>
            {verArquivadas && (
              <ConcluidasLista>
                {arquivadas.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white px-4 py-3"
                  >
                    <p className="min-w-0 truncate text-[14px] text-[var(--ink)]">{m.titulo}</p>
                    <button
                      type="button"
                      onClick={() => reabrir(m)}
                      disabled={limiteAtingido || atualizar.isPending}
                      title={
                        limiteAtingido
                          ? `Já tem ${ativas.length} metas ativas. Conclua ou arquive uma antes de reabrir.`
                          : undefined
                      }
                      className="inline-flex min-h-11 shrink-0 items-center text-[13px] text-[var(--secondary-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
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
          metaDoMesJaExiste={metaDoMesJaExiste(metaEdit?.id)}
          onClose={() => setModalAberto(false)}
          onSaved={() => {
            invalidar();
            setModalAberto(false);
          }}
        />
      )}

      {/* ───────── Confirmação: arquivar meta ───────── */}
      <ConfirmarAcao
        open={!!metaArquivar}
        onOpenChange={(open) => !open && setMetaArquivar(null)}
        titulo="Arquivar meta"
        descricao={
          metaArquivar
            ? ehMetaDoMes(metaArquivar)
              ? `"${metaArquivar.titulo}" sai da sua lista de metas ativas, e o Painel, o Financeiro e a Calculadora deixam de usar esse alvo. Dá pra reabrir em "Ver arquivadas".`
              : `"${metaArquivar.titulo}" sai da sua lista de metas ativas. Dá pra reabrir em "Ver arquivadas".`
            : undefined
        }
        textoConfirmar="Arquivar"
        destrutivo
        carregando={atualizar.isPending}
        onConfirmar={confirmarArquivar}
      />
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
  const [armada, setArmada] = useState(false);
  const pct = progressoPct(meta);
  const pronta = pct >= 100;
  const alvo = meta.valor_alvo ?? 0;
  const vencido = !!meta.prazo && meta.prazo < hojeISO();

  const reduceMotion = usePrefersReducedMotion();
  const [barraEntrou, setBarraEntrou] = useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setBarraEntrou(true)));
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

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
        {ehMetaDoMes(meta) ? (
          // Nome travado: é por ele que Painel, Financeiro, Calculadora,
          // Projeção e Raio-x acham esta meta (QA-19). O valor muda à vontade.
          <p
            className="min-h-6 min-w-0 flex-1 text-[17px] leading-snug text-[var(--ink)]"
            title="Esse nome liga a meta ao Painel, ao Financeiro e à Calculadora, por isso fica fixo."
          >
            {meta.titulo}
          </p>
        ) : (
          <InlineTitle titulo={meta.titulo} onCommit={onSalvarTitulo} />
        )}
        <div className="shrink-0">
          <MenuOpcoes
            align="end"
            itens={[
              { label: "Editar", onClick: onEditar },
              { label: "Arquivar", onClick: onArquivar, destrutivo: true },
            ]}
          />
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
              className={`h-full w-full origin-left rounded-full bg-[var(--secondary)] ${
                reduceMotion
                  ? ""
                  : "transition-transform duration-[200ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
              }`}
              style={{ transform: `scaleX(${(barraEntrou ? pct : 0) / 100})` }}
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
          type="button"
          onClick={clicarConcluir}
          className={`${BTN_MIUDO} shrink-0 ${
            pronta
              ? "!bg-[var(--secondary)]"
              : armada
                ? "!border-[var(--danger)] !text-[var(--danger)]"
                : "bg-white"
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
  // Enter chama commit, e um segundo Enter (ou o blur da desmontagem) antes
  // do re-render chamava de novo: duas gravações por edição (QA-32).
  const fechouRef = useRef(false);

  const start = () => {
    setDraft(titulo);
    fechouRef.current = false;
    setEditing(true);
  };
  const commit = () => {
    if (fechouRef.current) return;
    fechouRef.current = true;
    setEditing(false);
    const v = draft.trim();
    if (v && v !== titulo) onCommit(v);
  };
  const cancelar = () => {
    fechouRef.current = true;
    setEditing(false);
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
          if (e.key === "Escape") cancelar();
        }}
        className="min-w-0 flex-1 rounded-md border border-[var(--secondary-text)] px-2 py-1 text-[17px] text-[var(--ink)]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Editar título da meta"
      className="min-h-6 min-w-0 flex-1 text-left text-[17px] leading-snug text-[var(--ink)] hover:text-[var(--secondary-text)]"
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
  // Mesmo guarda do InlineTitle: um commit por edição (QA-32, Enter duplo).
  const fechouRef = useRef(false);

  const start = () => {
    setDraft(value ? String(value) : "");
    fechouRef.current = false;
    setEditing(true);
  };
  const commit = () => {
    if (fechouRef.current) return;
    fechouRef.current = true;
    setEditing(false);
    const v = num(draft);
    if (v !== value) onCommit(v);
  };
  const cancelar = () => {
    fechouRef.current = true;
    setEditing(false);
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
          if (e.key === "Escape") cancelar();
        }}
        className="min-h-6 w-24 rounded-md border border-[var(--secondary-text)] px-2 py-0.5 text-[14px] font-medium text-[var(--ink)]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label="Atualizar valor atual da meta"
      className="inline-flex min-h-6 min-w-6 items-center justify-center font-medium text-[var(--ink)] underline decoration-dotted decoration-[var(--muted)] underline-offset-2 hover:decoration-[var(--secondary)]"
    >
      {valorFmt(formato, value)}
    </button>
  );
}

/* ============== Modal: criar / editar meta ============== */
function ModalMeta({
  userId,
  metaEdit,
  metaDoMesJaExiste,
  onClose,
  onSaved,
}: {
  userId: string;
  metaEdit: Meta | null;
  /** Já há outra Meta do mês valendo, fora a que está em edição. */
  metaDoMesJaExiste: boolean;
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
  // A Meta do mês não troca de nome (5 telas a acham pelo título) e não ganha
  // gêmea: duas com o mesmo nome deixavam os números sem saber qual usar.
  const tituloTravado = !!metaEdit && ehMetaDoMes(metaEdit);
  const tituloDuplicaMetaDoMes = titulo.trim() === TITULO_META_DO_MES && metaDoMesJaExiste;
  const podeSalvar = titulo.trim().length > 0 && alvoNum > 0 && !tituloDuplicaMetaDoMes;

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
        // O erro do banco vem em inglês técnico: fica no log, não na tela.
        console.error("meta_salvar", error);
        setErro("A Pólia One não conseguiu salvar a meta agora. Tenta de novo.");
        return;
      }
      void registrar("edit_goal", { feature: "metas", propriedades: { formato } });
    } else {
      const { error } = await supabase.from("metas").insert({ user_id: userId, ...base });
      setSalvando(false);
      if (error) {
        // O erro do banco vem em inglês técnico: fica no log, não na tela.
        console.error("meta_salvar", error);
        setErro("A Pólia One não conseguiu salvar a meta agora. Tenta de novo.");
        return;
      }
      track("meta_criada", { formato });
      void registrar("create_goal", { feature: "metas", propriedades: { formato } });
    }
    onSaved();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={edit ? "Editar meta" : "Nova meta"}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !podeSalvar}
            className={BTN_ACAO}
          >
            {salvando ? "Salvando…" : edit ? "Salvar" : "Criar meta"}
          </button>
        </>
      }
    >
      {/* Título */}
      <div className="mb-4">
        <Campo label="Meta" required>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            readOnly={tituloTravado}
            aria-describedby={
              tituloTravado || tituloDuplicaMetaDoMes ? "meta-titulo-nota" : undefined
            }
            autoFocus={!tituloTravado}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none read-only:bg-[var(--surface)] read-only:text-[var(--ink-soft)]"
            placeholder="ex: chegar a 30 clientes fixas"
          />
        </Campo>
        {tituloTravado && (
          <p id="meta-titulo-nota" className="mt-1 text-[12px] text-[var(--muted)]">
            Esse nome liga a meta ao Painel, ao Financeiro e à Calculadora, por isso fica fixo. O
            valor muda à vontade.
          </p>
        )}
        {tituloDuplicaMetaDoMes && (
          <p id="meta-titulo-nota" role="alert" className="mt-1 text-[12px] text-[var(--danger)]">
            Já existe uma Meta do mês. Escolha outro nome pra esta meta.
          </p>
        )}
      </div>

      {/* Formato */}
      <div className="mb-4">
        <p id="meta-formato-rotulo" className="mb-1 block text-[12px] text-[var(--muted)]">
          Formato da medida
        </p>
        <div role="group" aria-labelledby="meta-formato-rotulo" className="flex gap-2">
          {(
            [
              { id: "numero", label: "Quantidade" },
              { id: "moeda", label: "Dinheiro (R$)" },
            ] as { id: Formato; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormato(f.id)}
              aria-pressed={formato === f.id}
              className={`${BTN_MIUDO} ${formato === f.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alvo + (unidade) */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label={formato === "moeda" ? "Meta (R$)" : "Meta (quanto alcançar)"} required>
          <input
            type="number"
            inputMode="decimal"
            value={alvo}
            onChange={(e) => setAlvo(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="0"
          />
        </Campo>
        {formato === "numero" && (
          <Campo label="Unidade">
            <input
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              maxLength={24}
              className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
              placeholder="clientes, vendas…"
            />
          </Campo>
        )}
      </div>

      {/* Atual */}
      <div className="mb-4">
        <Campo label="Valor atual, hoje">
          <input
            type="number"
            inputMode="decimal"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
            placeholder="0"
          />
        </Campo>
      </div>

      {/* Prazo */}
      <div>
        <Campo label="Data alvo (opcional)">
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none"
          />
        </Campo>
      </div>

      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}
    </Modal>
  );
}
