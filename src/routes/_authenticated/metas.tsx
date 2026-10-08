import { useEffect, useRef, useState, type ReactNode } from "react";
import { hojeISO, mesAnoAtual } from "@/lib/data.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { BTN_ACAO, BTN_ACAO_CONTORNO, BTN_MIUDO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { toastInfo } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { registrar } from "@/lib/founder-eventos";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { TITULO_META_DO_MES, metaDoMesConta } from "@/lib/metaDoMes";
import { progressoPct } from "@/lib/metas";
import { somarEntradasDoMes } from "@/lib/numerosDoMes";
import { formatarReais } from "@/lib/formatarReais";
import { useLinkDoModulo } from "@/lib/useLinkDoModulo";

interface MetasSearch {
  /** "meta-do-mes": abre direto o atalho que cria a Meta do mês (vem do Financeiro e da Projeção). */
  criar?: "meta-do-mes";
}

export const Route = createFileRoute("/_authenticated/metas")({
  validateSearch: (search: Record<string, unknown>): MetasSearch => ({
    criar: search.criar === "meta-do-mes" ? "meta-do-mes" : undefined,
  }),
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

// Dinheiro pelo formatador único (antes saía "R$ 44,1"); quantidade segue
// com até duas casas, sem zero sobrando.
function valorFmt(formato: string, v: number) {
  if (formato === "moeda") return formatarReais(v);
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
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
  const search = Route.useSearch();
  const navigate = useNavigate();
  const linkModulo6 = useLinkDoModulo(6);

  const [modalAberto, setModalAberto] = useState(false);
  const [metaEdit, setMetaEdit] = useState<Meta | null>(null);
  // Atalho "Criar a Meta do mês": o modal nasce com o nome exato e em R$.
  const [presetMetaDoMes, setPresetMetaDoMes] = useState(false);
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

  // O "atual" da Meta do mês é a soma das entradas do mês corrente, a mesma
  // conta do Painel e do Financeiro (08/10/2026). Antes esta tela mostrava o
  // valor_atual digitado à mão, e a mesma meta tinha três progressos.
  const temMetaDoMesAtiva = ativas.some(ehMetaDoMes);
  const [{ ano: anoCorrente, mes: mesCorrente }] = useState(() => mesAnoAtual());
  const entradasMesQuery = useQuery({
    queryKey: ["metas-entradas-mes", userId, anoCorrente, mesCorrente],
    enabled: !!userId && temMetaDoMesAtiva,
    queryFn: () => somarEntradasDoMes(supabase, userId!, anoCorrente, mesCorrente),
  });
  const valorDoMes: ValorDoMes = {
    carregando: entradasMesQuery.isLoading,
    erro: entradasMesQuery.isError,
    valor: entradasMesQuery.data ?? 0,
    tentarDeNovo: () => void entradasMesQuery.refetch(),
  };

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
    // Na Meta do mês o "atual" vem das entradas: concluir não grava valor.
    const doMes = ehMetaDoMes(m);
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
        ...(m.valor_alvo != null && !doMes ? { valor_atual: m.valor_alvo } : {}),
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
    setPresetMetaDoMes(false);
    setModalAberto(true);
  };

  const abrirCriarMetaDoMes = () => {
    if (limiteAtingido || metaDoMesJaExiste()) return;
    setMetaEdit(null);
    setPresetMetaDoMes(true);
    setModalAberto(true);
  };

  const abrirEditar = (m: Meta) => {
    setMetaEdit(m);
    setPresetMetaDoMes(false);
    setModalAberto(true);
  };

  // ?criar=meta-do-mes (link "Criar a Meta do mês" do Financeiro e da
  // Projeção): abre o atalho uma vez, depois de saber quais metas já existem,
  // e limpa a URL pra um F5 não abrir de novo.
  const criarPedido = search.criar;
  const listaPronta = metasQuery.isSuccess;
  useEffect(() => {
    if (criarPedido !== "meta-do-mes" || !listaPronta) return;
    if (!metaDoMesJaExiste()) {
      if (limiteAtingido) {
        setErroAcao(
          `Já tem ${ativas.length} metas ativas. Conclua ou arquive uma pra criar a Meta do mês.`,
        );
      } else {
        abrirCriarMetaDoMes();
      }
    }
    void navigate({ to: "/metas", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criarPedido, listaPronta]);

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

        {/* ───────── Atalho: Meta do mês ───────── */}
        {/* Painel, Financeiro, Calculadora e Projeção acham essa meta pelo nome
            exato. Criada à mão com outro nome ("meta de outubro"), nenhuma tela
            a enxerga; o atalho já nasce com o nome certo e em R$. */}
        {metasQuery.isSuccess && !metaDoMesJaExiste() && (
          <section className="mt-6 rounded-xl bg-[var(--surface)] p-5">
            <p className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Meta do mês
            </p>
            <p className="mt-2 max-w-[60ch] text-[14px] text-[var(--ink-soft)]">
              Ainda não tem Meta do mês. É o valor em R$ que o mês precisa trazer, e o Painel e o
              Financeiro acompanham somando as entradas registradas.
            </p>
            <button
              type="button"
              onClick={abrirCriarMetaDoMes}
              disabled={limiteAtingido}
              className={`${BTN_ACAO_CONTORNO} mt-4 bg-white`}
            >
              <Target size={15} aria-hidden="true" />
              Criar a Meta do mês
            </button>
            {limiteAtingido && (
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                Conclua ou arquive uma meta ativa antes de criar a Meta do mês.
              </p>
            )}
          </section>
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
                // A ação do vazio é a da própria tela. O Planejamento é caminho
                // secundário e só aponta pro Módulo 6 quando ele está liberado
                // (antes o botão principal levava a um módulo trancado).
                <>
                  <button
                    type="button"
                    onClick={abrirCriar}
                    disabled={limiteAtingido}
                    className={BTN_ACAO}
                  >
                    <Plus size={16} aria-hidden="true" /> Nova meta
                  </button>
                  <p className="mt-3 text-[12px] text-[var(--muted)]">
                    ou defina pelo{" "}
                    <LinkInterno
                      href={linkModulo6.href}
                      className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
                    >
                      {linkModulo6.liberado ? "Módulo 6 do Planejamento →" : "Planejamento →"}
                    </LinkInterno>
                  </p>
                </>
              }
            />
          ) : (
            <ul className="space-y-3">
              {ativas.map((m) => (
                <MetaCard
                  key={m.id}
                  meta={m}
                  valorDoMes={ehMetaDoMes(m) ? valorDoMes : undefined}
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
          presetMetaDoMes={presetMetaDoMes}
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
interface ValorDoMes {
  carregando: boolean;
  erro: boolean;
  valor: number;
  tentarDeNovo: () => void;
}

function MetaCard({
  meta,
  valorDoMes,
  onEditar,
  onArquivar,
  onConcluir,
  onSalvarTitulo,
  onSalvarAtual,
}: {
  meta: Meta;
  /** Só na Meta do mês: o "atual" é a soma das entradas do mês, não o digitado. */
  valorDoMes?: ValorDoMes;
  onEditar: () => void;
  onArquivar: () => void;
  onConcluir: () => void;
  onSalvarTitulo: (titulo: string) => void;
  onSalvarAtual: (valor: number) => void;
}) {
  const [armada, setArmada] = useState(false);
  const atual = valorDoMes ? valorDoMes.valor : meta.valor_atual;
  const pct = valorDoMes
    ? valorDoMes.carregando || valorDoMes.erro
      ? 0
      : progressoPct({ valor_atual: atual, valor_alvo: meta.valor_alvo })
    : progressoPct(meta);
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
          {valorDoMes ? (
            <span className="font-medium text-[var(--ink)]">
              {valorDoMes.carregando ? "…" : valorDoMes.erro ? "?" : formatarReais(atual)}
            </span>
          ) : (
            <InlineValor value={meta.valor_atual} formato={meta.formato} onCommit={onSalvarAtual} />
          )}
          <span className="text-[var(--muted)]"> de </span>
          <span className="font-medium text-[var(--ink)]">
            {valorDoMes ? formatarReais(alvo) : valorFmt(meta.formato, alvo)}
            {valorDoMes ? "" : sufixoUnidade(meta)}
          </span>
        </p>
        {valorDoMes &&
          (valorDoMes.erro ? (
            <p role="alert" className="mt-1 text-[12px] text-[var(--danger)]">
              A Pólia One não conseguiu somar as entradas do mês agora.{" "}
              <button
                type="button"
                onClick={valorDoMes.tentarDeNovo}
                className="inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] underline-offset-2 hover:underline"
              >
                Tentar de novo
              </button>
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              Vem das entradas registradas neste mês, as mesmas que o Painel soma.
            </p>
          ))}

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
          className={`${BTN_MIUDO_ACAO} shrink-0 ${
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
  presetMetaDoMes = false,
  metaDoMesJaExiste,
  onClose,
  onSaved,
}: {
  userId: string;
  metaEdit: Meta | null;
  /** Atalho "Criar a Meta do mês": nasce com o nome exato, travado, e em R$. */
  presetMetaDoMes?: boolean;
  /** Já há outra Meta do mês valendo, fora a que está em edição. */
  metaDoMesJaExiste: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edit = !!metaEdit;

  const criandoMetaDoMes = !metaEdit && presetMetaDoMes;
  const [titulo, setTitulo] = useState(
    metaEdit?.titulo ?? (criandoMetaDoMes ? TITULO_META_DO_MES : ""),
  );
  const [formatoEscolhido, setFormato] = useState<Formato>(
    (metaEdit?.formato as Formato) ?? (criandoMetaDoMes ? "moeda" : "numero"),
  );
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
  const tituloTravado = (!!metaEdit && ehMetaDoMes(metaEdit)) || criandoMetaDoMes;
  const tituloDuplicaMetaDoMes = titulo.trim() === TITULO_META_DO_MES && metaDoMesJaExiste;
  // A Meta do mês é sempre em R$ e o "atual" dela vem das entradas do mês:
  // não se escolhe formato nem se digita valor atual.
  const ehDoMes = titulo.trim() === TITULO_META_DO_MES;
  const formato: Formato = ehDoMes ? "moeda" : formatoEscolhido;
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
      valor_atual: ehDoMes ? (metaEdit?.valor_atual ?? 0) : atual.trim() ? num(atual) : 0,
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
      title={edit ? "Editar meta" : criandoMetaDoMes ? "Criar a Meta do mês" : "Nova meta"}
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
              disabled={ehDoMes}
              className={`${BTN_MIUDO} ${formato === f.id ? "!bg-[var(--secondary)]" : "bg-white"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {ehDoMes && (
          <p className="mt-1 text-[12px] text-[var(--muted)]">A Meta do mês é sempre em R$.</p>
        )}
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
        <Campo
          label="Valor atual, hoje"
          hint={
            ehDoMes
              ? "Vem das entradas registradas neste mês. A Pólia One soma sozinha, não precisa digitar."
              : undefined
          }
        >
          <input
            type="number"
            inputMode="decimal"
            value={ehDoMes ? "" : atual}
            onChange={(e) => setAtual(e.target.value)}
            readOnly={ehDoMes}
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none read-only:bg-[var(--surface)] read-only:text-[var(--ink-soft)]"
            placeholder={ehDoMes ? "soma das entradas do mês" : "0"}
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
