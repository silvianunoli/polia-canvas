import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, BarChart3, Check, Lock } from "lucide-react";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { TOTAL_MODULOS, moduloInfo, secoesDoModulo } from "@/lib/planejamento";
import { hojeISO, ehMesAtual } from "@/lib/data.functions";
import { rotaLiberada } from "@/lib/planos";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel · Pólia" },
      {
        name: "description",
        content: "Seu painel da Pólia: o próximo módulo, seu dia e o ar do seu negócio.",
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
      throw redirect({ to: "/onboarding" });
    }
  },
  component: PainelPage,
});

function getSaudacao() {
  const agora = new Date();
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  if (minutos < 12 * 60) return "Bom dia";
  if (minutos < 18 * 60 + 30) return "Boa tarde";
  return "Boa noite";
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  s.setHours(0, 0, 0, 0);
  return s;
}

function fmtBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ordinal(n: number) {
  return `${n}º`;
}

// Extrai o primeiro número de um texto livre em pt-BR ("R$ 6.000" → 6000).
function numeroDe(texto: string): number {
  const m = texto.match(/[\d.,]+/);
  if (!m) return 0;
  let s = m[0];
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  } else if (temPonto) {
    const partes = s.split(".");
    if (partes.length === 2 && partes[1].length === 3) s = partes.join("");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Receita, Pedidos e Clientes são métricas comparáveis do mesmo mês, então têm
// largura igual (4/4/4). Antes eram 5/3/4 — três larguras diferentes sugerem
// três importâncias diferentes, que não é o caso. Mesmo erro já corrigido no
// bento do /planejamento.
const SPAN_CLASS: Record<number, string> = {
  4: "col-span-12 sm:col-span-4",
  6: "col-span-12 sm:col-span-6",
  12: "col-span-12",
};

const BOTAO_PRIMARIO =
  "inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--ink)] bg-[var(--secondary)] px-5 py-2.5 text-[14px] font-semibold text-[var(--secondary-ink)] no-underline transition-transform hover:-translate-y-px";

// Quantas tarefas cada grupo mostra antes de mandar pro Planner. Sem teto, uma
// usuária com 26 atrasadas ganhava um cartão de 1.328px e uma parede vermelha
// na abertura do painel.
const LIMITE_TAREFAS = 5;

function upgradeHref(rota: string) {
  return `/upgrade?rota=${encodeURIComponent(rota)}&tier=controle`;
}

/**
 * Selo de bloqueio, na mesma linguagem do cadeado da barra lateral. Existe
 * porque o painel mostrava métrica de página fechada sem nenhum aviso: a
 * usuária do Confere clicava em "Quanto sobrou" e caía no /upgrade sem saber
 * por quê.
 */
function SeloControle() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
      <Lock size={10} aria-hidden="true" />
      no Controle
    </span>
  );
}

/**
 * Rótulo de cartão. É <h2> pra dar sumário à página (o painel inteiro tinha um
 * único heading), mas mantém `font-sans`: Cabinet Grotesk é a face de display,
 * restrita a texto grande e curto, e ficaria errada em caixa alta de 10px.
 */
function TituloCartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-sans ${className}`}>{children}</h2>;
}

interface SecaoRow {
  secao: string;
  concluido: boolean;
}
interface CampoRow {
  campo: string;
  valor: string | null;
}
interface LancRow {
  tipo: string;
  valor: number;
  data: string;
}
interface ClienteRow {
  status_pedido: string | null;
}
interface QuadroRow {
  id: string;
  nome: string;
  slug: string;
}
interface TarefaRow {
  id: string;
  titulo: string;
  status: string;
  quadro_id: string | null;
  prazo: string | null;
  horario: string | null;
  created_at: string;
  updated_at: string;
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDDMM(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ── Motion (respeita prefers-reduced-motion) ──
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

function useEntrada() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return shown;
}

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduce) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduce]);
  return (
    <div
      ref={ref}
      className={className}
      style={
        reduce
          ? undefined
          : {
              opacity: shown ? 1 : 0,
              transform: shown ? "none" : "translateY(12px)",
              transition:
                "opacity 240ms cubic-bezier(0.22,1,0.36,1), transform 240ms cubic-bezier(0.22,1,0.36,1)",
            }
      }
    >
      {children}
    </div>
  );
}

function PainelPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const qc = useQueryClient();

  const reduce = usePrefersReducedMotion();
  const entrou = useEntrada();
  const barOn = reduce || entrou;

  // O painel exibia métrica de rota que o Confere não abre (Financeiro,
  // Clientes, Calendário) com link direto e sem cadeado: mostrava o número,
  // mandava registrar e barrava na porta. Agora cada bloco fechado diz que é
  // fechado e leva pro /upgrade, igual à barra lateral.
  const financeiroLiberado = rotaLiberada("/financeiro", meta.plano);
  const clientesLiberado = rotaLiberada("/clientes", meta.plano);
  const calendarioLiberado = rotaLiberada("/calendario", meta.plano);
  const destino = (rota: string, liberado: boolean) => (liberado ? rota : upgradeHref(rota));

  const dadosQuery = useQuery({
    queryKey: ["painel-dados", userId],
    enabled: !!userId,
    queryFn: async () => {
      const hoje = hojeISO();
      const [
        profileRes,
        secoesRes,
        camposRes,
        metaMesRes,
        lancRes,
        clientesRes,
        quadrosRes,
        tarefasRes,
        intencaoRes,
      ] = await Promise.all([
        supabase.from("profiles").select("created_at").eq("id", userId!).maybeSingle(),
        supabase
          .from("planejamento_secoes" as never)
          .select("secao, concluido")
          .eq("user_id", userId!),
        supabase
          .from("planejamento_campos" as never)
          .select("campo, valor")
          .eq("user_id", userId!)
          .in("campo", ["financeiro.meta_celebracao"]),
        // Meta do mês: fonte única (mesma que Financeiro e a calculadora de Produtos lêem).
        supabase
          .from("metas")
          .select("valor_alvo")
          .eq("user_id", userId!)
          .eq("titulo", "Meta do mês")
          .maybeSingle(),
        supabase.from("lancamentos").select("tipo, valor, data").eq("user_id", userId!),
        supabase
          .from("clientes" as never)
          .select("status_pedido")
          .eq("user_id", userId!),
        supabase.from("quadros").select("id, nome, slug").eq("user_id", userId!),
        supabase
          .from("tarefas")
          .select("id, titulo, status, quadro_id, prazo, horario, created_at, updated_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("intencoes_dia" as never)
          .select("texto")
          .eq("user_id", userId!)
          .eq("data", hoje)
          .maybeSingle(),
      ]);
      return {
        createdAt: (profileRes.data as { created_at: string } | null)?.created_at ?? null,
        secoes: ((secoesRes as unknown as { data: SecaoRow[] | null }).data ?? []) as SecaoRow[],
        campos: ((camposRes as unknown as { data: CampoRow[] | null }).data ?? []) as CampoRow[],
        metaMesAlvo: (metaMesRes.data as { valor_alvo: number | null } | null)?.valor_alvo ?? 0,
        lancamentos: (lancRes.data ?? []) as unknown as LancRow[],
        clientes: ((clientesRes as unknown as { data: ClienteRow[] | null }).data ??
          []) as ClienteRow[],
        quadros: (quadrosRes.data ?? []) as unknown as QuadroRow[],
        tarefas: (tarefasRes.data ?? []) as unknown as TarefaRow[],
        intencao:
          (intencaoRes as unknown as { data: { texto: string } | null }).data?.texto ?? null,
      };
    },
  });

  const dados = dadosQuery.data;

  // ── Progresso do planejamento (mesma fonte da tela /planejamento) ──
  const concluidas = useMemo(
    () => new Set((dados?.secoes ?? []).filter((s) => s.concluido).map((s) => s.secao)),
    [dados?.secoes],
  );
  const moduloAtual = useMemo(() => {
    for (let n = 1; n <= TOTAL_MODULOS; n++) {
      if (!secoesDoModulo(n).every((s) => concluidas.has(s.id))) return n;
    }
    return TOTAL_MODULOS + 1;
  }, [concluidas]);
  const jornadaFinalizada = moduloAtual > TOTAL_MODULOS;
  const etapaInfo = moduloInfo(jornadaFinalizada ? TOTAL_MODULOS : moduloAtual);

  const diasDesdeCadastro = useMemo(() => {
    const c = dados?.createdAt;
    if (!c) return 1;
    return Math.max(1, Math.floor((Date.now() - new Date(c).getTime()) / 86400000));
  }, [dados?.createdAt]);

  const campoValor = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of dados?.campos ?? []) if (c.valor && c.valor.trim()) m.set(c.campo, c.valor);
    return m;
  }, [dados?.campos]);
  // Meta do mês: mesma fonte que Financeiro e a calculadora de Produtos (tabela `metas`).
  const metaBoa = dados?.metaMesAlvo ?? 0;
  const metaCelebracao = useMemo(() => {
    const v = campoValor.get("financeiro.meta_celebracao");
    return v ? numeroDe(v) : 0;
  }, [campoValor]);

  // ── Métricas reais do mês corrente (calculado no cliente pra não divergir na hidratação SSR) ──
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  const { receitaMes, pedidosMes, lucroMes } = useMemo(() => {
    if (!clientReady) return { receitaMes: 0, pedidosMes: 0, lucroMes: 0 };
    let receita = 0;
    let saida = 0;
    let pedidos = 0;
    for (const l of dados?.lancamentos ?? []) {
      if (!l.data || !ehMesAtual(l.data)) continue;
      if (l.tipo === "entrada") {
        receita += Number(l.valor);
        pedidos += 1;
      } else if (l.tipo === "saida") {
        saida += Number(l.valor);
      }
    }
    return { receitaMes: receita, pedidosMes: pedidos, lucroMes: receita - saida };
  }, [dados?.lancamentos, clientReady]);

  const clientes = dados?.clientes ?? [];
  const clientesCount = clientes.length;
  const clientesEntregues = clientes.filter((c) => c.status_pedido === "Entregue").length;
  const clientesEmEspera = clientes.filter((c) => c.status_pedido === "Em espera").length;

  // ── Suas tarefas (quadros do Planner, agrupadas por prazo) ──
  const quadros = dados?.quadros ?? [];
  const quadrosPorId = useMemo(() => new Map(quadros.map((q) => [q.id, q])), [quadros]);
  const tarefasQuadro = useMemo(
    () => (dados?.tarefas ?? []).filter((t) => t.quadro_id),
    [dados?.tarefas],
  );
  const linkTarefa = (t: TarefaRow) => {
    const q = t.quadro_id ? quadrosPorId.get(t.quadro_id) : null;
    return q ? `/planner/${q.slug}` : "/planner";
  };
  const gruposTarefas = useMemo(() => {
    if (!clientReady) return { atrasadas: [], hoje: [], proximas: [] as typeof tarefasQuadro };
    const hoje = hojeISO();
    const em7dias = addDias(hoje, 7);
    const pendentes = tarefasQuadro.filter((t) => t.status !== "concluido");
    // Ordena por prazo: com teto de 5 por grupo, quem aparece tem que ser quem
    // mais espera. Antes vinha na ordem de criação, então "era pra 28/06"
    // caía embaixo de "era pra 27/07" e o corte pegaria as erradas.
    const porPrazo = (a: TarefaRow, b: TarefaRow) => (a.prazo ?? "").localeCompare(b.prazo ?? "");
    const atrasadas = pendentes.filter((t) => t.prazo && t.prazo < hoje).sort(porPrazo);
    const hojeGrupo = pendentes
      .filter((t) => t.prazo === hoje)
      .sort((a, b) => (a.horario ?? "99:99").localeCompare(b.horario ?? "99:99"));
    const proximas = pendentes
      .filter((t) => t.prazo && t.prazo > hoje && t.prazo <= em7dias)
      .sort(porPrazo);
    return { atrasadas, hoje: hojeGrupo, proximas };
  }, [tarefasQuadro, clientReady]);
  const totalTarefasPainel =
    gruposTarefas.atrasadas.length + gruposTarefas.hoje.length + gruposTarefas.proximas.length;
  const quadroPendentesLink = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const t of tarefasQuadro) {
      if (t.status === "concluido" || !t.quadro_id) continue;
      contagem.set(t.quadro_id, (contagem.get(t.quadro_id) ?? 0) + 1);
    }
    let melhor: { slug: string; n: number } | null = null;
    for (const [qid, n] of contagem) {
      const q = quadrosPorId.get(qid);
      if (!q) continue;
      if (!melhor || n > melhor.n) melhor = { slug: q.slug, n };
    }
    return melhor ? `/planner/${melhor.slug}` : "/planner";
  }, [tarefasQuadro, quadrosPorId]);

  // ── Headline ancorada em dado real ──
  const headline: ReactNode = useMemo(() => {
    // No Confere o Financeiro é fechado, então receita é sempre 0 e a manchete
    // caía fixa em "registre sua primeira venda" — mandando fazer exatamente o
    // que o plano não deixa, e contradizendo o cartão vizinho de clientes
    // entregues. A manchete do plano gratuito ancora no que ele entrega.
    if (!financeiroLiberado) {
      return jornadaFinalizada
        ? "Planejamento fechado. Falta ver quanto sobra."
        : `O Módulo ${moduloAtual} continua aberto no Planejamento.`;
    }
    if (receitaMes <= 0) {
      return "Vamos registrar sua primeira venda?";
    }
    if (metaBoa > 0 && receitaMes >= metaBoa) {
      return "Mês bom batido. Agora é caminho pro mês de celebrar.";
    }
    if (metaBoa > 0) {
      return (
        <>
          Faltam <span className="whitespace-nowrap">{fmtBRL(metaBoa - receitaMes)}</span> pra
          fechar a Meta do mês.
        </>
      );
    }
    return (
      <>
        Seu mês já soma <span className="whitespace-nowrap">{fmtBRL(receitaMes)}</span>.
      </>
    );
  }, [receitaMes, metaBoa, financeiroLiberado, jornadaFinalizada, moduloAtual]);

  // A manchete nomeava a próxima ação e a tela não oferecia nada clicável: era
  // uma pergunta sem botão. Os dados que escolhem o texto já estavam todos
  // calculados aqui.
  const acaoPrincipal = useMemo(() => {
    if (!financeiroLiberado) {
      return jornadaFinalizada
        ? { texto: "Conhecer o Controle", href: upgradeHref("/financeiro") }
        : {
            texto: `Continuar o Módulo ${moduloAtual}`,
            href: `/planejamento/modulo/${moduloAtual}`,
          };
    }
    if (receitaMes <= 0) return { texto: "Registrar uma entrada", href: "/financeiro" };
    return { texto: "Abrir o Financeiro", href: "/financeiro" };
  }, [financeiroLiberado, jornadaFinalizada, moduloAtual, receitaMes]);

  // ── Semana de trabalho (tarefas concluídas por dia) ──
  const [saudacao, setSaudacao] = useState("Olá");
  useEffect(() => setSaudacao(getSaudacao()), []);

  // ── Intenção do dia (persiste por dia; se ficar vazia, fica em silêncio) ──
  const [editandoIntencao, setEditandoIntencao] = useState(false);
  const [rascunhoIntencao, setRascunhoIntencao] = useState("");
  const intencaoSalva = dados?.intencao ?? null;
  useEffect(() => {
    if (!editandoIntencao) setRascunhoIntencao(intencaoSalva ?? "");
  }, [intencaoSalva, editandoIntencao]);

  const salvarIntencao = async () => {
    const texto = rascunhoIntencao.trim();
    if (!texto || !userId) return;
    setEditandoIntencao(false);
    const { error } = await supabase
      .from("intencoes_dia" as never)
      .upsert(
        { user_id: userId, data: hojeISO(), texto, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id,data" },
      );
    if (error) {
      toastErro("Não consegui guardar sua intenção. Tenta de novo.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["painel-dados", userId] });
  };

  const dias = useMemo(() => {
    const abrevs = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    if (!clientReady)
      return abrevs.map((abrev) => ({ abrev, tarefas: 0, isHoje: false, isFuturo: false }));
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const ini = startOfWeek(hoje);
    const tarefas = dados?.tarefas ?? [];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(ini);
      d.setDate(ini.getDate() + i);
      const count = tarefas.filter((t) => {
        if (t.status !== "concluido") return false;
        // Conta pelo dia da conclusão (updated_at), não da criação — senão uma
        // tarefa criada segunda e concluída sexta aparecia contada na segunda.
        const td = new Date(t.updated_at);
        return (
          td.getFullYear() === d.getFullYear() &&
          td.getMonth() === d.getMonth() &&
          td.getDate() === d.getDate()
        );
      }).length;
      return {
        abrev: abrevs[i],
        tarefas: count,
        isHoje: d.getTime() === hoje.getTime(),
        isFuturo: d.getTime() > hoje.getTime(),
      };
    });
  }, [dados?.tarefas, clientReady]);
  const maxSemana = Math.max(1, ...dias.map((d) => d.tarefas));
  const semanaVazia = dias.every((d) => d.tarefas === 0);

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto w-full max-w-[1120px] px-6 pb-24 pt-16 md:px-10">
        {/* Header: primeira dobra, sem reveal */}
        <div>
          <p className="font-fraunces text-[19px] italic text-[var(--ink-soft)]">
            {saudacao}, {meta.displayName}.
          </p>
          <h1 className="font-cabinet mt-2 max-w-[22em] text-[clamp(28px,5vw,44px)] leading-[1.12] text-[var(--ink)]">
            {headline}
          </h1>

          <a href={acaoPrincipal.href} className={`${BOTAO_PRIMARIO} mt-5`}>
            {acaoPrincipal.texto}
            <span aria-hidden="true">→</span>
          </a>

          {/* Intenção do dia */}
          <div className="mt-6 max-w-[560px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              {intencaoSalva && !editandoIntencao
                ? "Intenção de hoje"
                : "Qual é a sua intenção pra hoje?"}
            </p>
            {editandoIntencao || !intencaoSalva ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={rascunhoIntencao}
                  onChange={(e) => setRascunhoIntencao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") salvarIntencao();
                    if (e.key === "Escape" && intencaoSalva) setEditandoIntencao(false);
                  }}
                  placeholder="Ex: gravar a aula e não abrir o Instagram até o almoço"
                  className="h-[38px] flex-1 rounded-lg border border-[var(--line)] px-3 text-[14px] text-[var(--ink-soft)] outline-none focus:border-[var(--secondary)]"
                />
                <button
                  type="button"
                  onClick={salvarIntencao}
                  aria-label="Guardar intenção"
                  title="Guardar intenção"
                  className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[var(--ink)] bg-[var(--secondary)] text-[var(--secondary-ink)] transition-transform duration-150 hover:-translate-y-px"
                >
                  <Check size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-fraunces text-[19px] italic text-[var(--ink-soft)]">
                  {intencaoSalva}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRascunhoIntencao(intencaoSalva ?? "");
                    setEditandoIntencao(true);
                  }}
                  aria-label="Editar intenção"
                  title="Editar intenção"
                  className="rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--secondary-light)] hover:text-[var(--ink)]"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Linha de contexto */}
        <Reveal className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-y border-[var(--line)] py-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Dia no planejamento
            </span>
            <span className="font-cabinet rounded-lg bg-[var(--highlight)] px-3 py-0.5 text-[19px] font-semibold text-[var(--highlight-ink)]">
              {ordinal(diasDesdeCadastro)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Status
            </span>
            <span className="text-[15px] text-[var(--ink-soft)]">
              {jornadaFinalizada
                ? "Planejamento concluído"
                : `Módulo ${moduloAtual} · ${etapaInfo.nome}`}
            </span>
            {/* Era um "ver" da mesma cor do texto e sem sublinhado, colado na
                frase: lia como "Planejamento concluído ver". */}
            <a
              href="/planejamento"
              className="text-[14px] text-[var(--secondary-text)] underline-offset-2 hover:underline"
            >
              abrir
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
              Presença
            </span>
            <span className="text-[15px] text-[var(--ink-soft)]">
              {meta.streak} {meta.streak === 1 ? "dia" : "dias"}
            </span>
          </div>
        </Reveal>

        {/* Quanto sobrou este mês: a resposta real de "quanto sobra", na primeira tela */}
        <Reveal className="mt-6">
          <a
            href={destino("/financeiro", financeiroLiberado)}
            className="group block rounded-xl border border-[var(--line)] bg-white p-6 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <TituloCartao className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Quanto sobrou · mês
              </TituloCartao>
              {!financeiroLiberado && <SeloControle />}
            </div>
            {/* Sem Financeiro não existe lançamento, então "R$ 0" seria uma
                afirmação falsa (não é que não sobrou: é que não há o que somar). */}
            <p
              className={`font-cabinet mt-1 text-[40px] leading-none ${
                financeiroLiberado && lucroMes < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"
              }`}
            >
              {financeiroLiberado ? fmtBRL(lucroMes) : "—"}
            </p>
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              {!financeiroLiberado ? (
                "entradas e saídas do mês fechadas num lugar só"
              ) : (
                <>
                  {receitaMes > 0
                    ? `${Math.max(0, Math.round((lucroMes / receitaMes) * 100))}% do que entrou virou lucro`
                    : "registre entradas e saídas pra ver"}{" "}
                  · <span className="text-[var(--ink-soft)]">Financeiro</span>
                </>
              )}
            </p>
          </a>
        </Reveal>

        {/* Bento de dados */}
        <div className="mt-6 grid grid-cols-12 gap-4">
          <Reveal className={SPAN_CLASS[4]}>
            <a
              href={destino("/financeiro", financeiroLiberado)}
              className="group block rounded-xl border border-[var(--line)] bg-white p-5 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <TituloCartao className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Receita · mês
                </TituloCartao>
                {!financeiroLiberado && <SeloControle />}
              </div>
              <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
                {financeiroLiberado ? fmtBRL(receitaMes) : "—"}
              </p>
              {financeiroLiberado && metaCelebracao > 0 && (
                <div className="relative mx-0.5 mt-4 h-2 rounded-md border border-[var(--line)] bg-[var(--bg)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md bg-[var(--secondary)]"
                    style={{
                      width: barOn
                        ? `${Math.min(100, (receitaMes / metaCelebracao) * 100)}%`
                        : "0%",
                      transition: reduce ? "none" : "width 800ms cubic-bezier(0.22,1,0.36,1)",
                    }}
                  />
                  {metaBoa > 0 && (
                    <div
                      className="absolute -top-1 -bottom-1 w-0.5 bg-[var(--ink)]"
                      style={{ left: `${Math.min(100, (metaBoa / metaCelebracao) * 100)}%` }}
                    />
                  )}
                </div>
              )}
              <p className="mt-2 text-[13px] text-[var(--muted)]">
                {!financeiroLiberado ? (
                  "quanto entrou, e quanto falta pra meta"
                ) : (
                  <>
                    {metaBoa > 0
                      ? `${Math.min(100, Math.round((receitaMes / metaBoa) * 100))}% da Meta do mês (${fmtBRL(metaBoa)})`
                      : receitaMes > 0
                        ? "entradas esse mês"
                        : "ainda sem entradas"}{" "}
                    · <span className="text-[var(--ink-soft)]">Financeiro</span>
                  </>
                )}
              </p>
            </a>
          </Reveal>

          <Reveal className={SPAN_CLASS[4]}>
            <a
              href={destino("/financeiro", financeiroLiberado)}
              className="group block rounded-xl border border-[var(--line)] bg-white p-5 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <TituloCartao className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Pedidos · mês
                </TituloCartao>
                {!financeiroLiberado && <SeloControle />}
              </div>
              <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
                {financeiroLiberado ? pedidosMes : "—"}
              </p>
              <p className="mt-2 text-[13px] text-[var(--muted)]">
                {!financeiroLiberado ? (
                  "quantas vendas o mês fechou"
                ) : (
                  <>
                    {pedidosMes > 0 ? "vendas registradas" : "nenhuma ainda"} ·{" "}
                    <span className="text-[var(--ink-soft)]">ver entradas</span>
                  </>
                )}
              </p>
            </a>
          </Reveal>

          <Reveal className={SPAN_CLASS[4]}>
            <a
              href={destino("/clientes", clientesLiberado)}
              className="group block rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <TituloCartao className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Clientes
                </TituloCartao>
                {!clientesLiberado && <SeloControle />}
              </div>
              <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
                {clientesCount}
              </p>
              <p className="mt-2 text-[13px] text-[var(--muted)]">
                {clientesCount > 0
                  ? `${clientesEntregues} entregues · ${clientesEmEspera} em espera`
                  : "nenhuma cadastrada ainda"}{" "}
                ·{" "}
                <span className="text-[var(--ink-soft)]">
                  {clientesLiberado ? "Clientes" : "abre no Controle"}
                </span>
              </p>
            </a>
          </Reveal>

          {/* Tarefas de hoje */}
          <Reveal className={SPAN_CLASS[6]}>
            <div className="group rounded-xl border border-[var(--line)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white transition-colors duration-200 group-hover:bg-[var(--secondary-light)]">
                  <Pencil size={19} className="text-[var(--ink)]" aria-hidden="true" />
                </span>
                <div>
                  <TituloCartao className="text-[18px] text-[var(--ink)]">
                    Suas tarefas
                  </TituloCartao>
                  <p className="text-[13px] text-[var(--muted)]">
                    do Planner · {gruposTarefas.atrasadas.length}{" "}
                    {gruposTarefas.atrasadas.length === 1 ? "atrasada" : "atrasadas"} ·{" "}
                    {gruposTarefas.hoje.length} pra hoje · {gruposTarefas.proximas.length}{" "}
                    {gruposTarefas.proximas.length === 1 ? "próxima" : "próximas"}
                  </p>
                </div>
              </div>

              {totalTarefasPainel === 0 ? (
                <p className="mt-4 text-[14px] text-[var(--muted)]">
                  Nada nos seus quadros por perto.
                </p>
              ) : (
                <div className="mt-3">
                  {gruposTarefas.atrasadas.length > 0 && (
                    <GrupoTarefasPainel
                      titulo="Ficou pra trás"
                      corTitulo="text-[var(--danger)]"
                      itens={gruposTarefas.atrasadas}
                      rotulo={(t) => `era pra ${fmtDDMM(t.prazo!)}`}
                      corRotulo="text-[var(--danger)]"
                      destacarAte={3}
                      linkTarefa={linkTarefa}
                      link={`${quadroPendentesLink}?filtro=all`}
                      linkTitulo="Abrir o Planner"
                      rotuloMais={(n) => `mais ${n} ${n === 1 ? "atrasada" : "atrasadas"}`}
                    />
                  )}
                  {gruposTarefas.hoje.length > 0 && (
                    <GrupoTarefasPainel
                      titulo="Hoje"
                      itens={gruposTarefas.hoje}
                      rotulo={(t) => (t.horario ? `hoje · ${t.horario}` : "prazo hoje")}
                      linkTarefa={linkTarefa}
                      link={`${quadroPendentesLink}?filtro=today`}
                      linkTitulo="Abrir o Planner filtrado em Hoje"
                      rotuloMais={(n) => `mais ${n} pra hoje`}
                    />
                  )}
                  {gruposTarefas.proximas.length > 0 && (
                    <GrupoTarefasPainel
                      titulo="Próximos 7 dias"
                      itens={gruposTarefas.proximas}
                      rotulo={(t) => `até ${fmtDDMM(t.prazo!)}`}
                      linkTarefa={linkTarefa}
                      link={`${quadroPendentesLink}?filtro=7`}
                      linkTitulo="Abrir o Planner filtrado em 7 dias"
                      rotuloMais={(n) => `mais ${n} nos próximos dias`}
                    />
                  )}
                </div>
              )}

              <p className="mt-3 text-[13px]">
                <a
                  href={quadroPendentesLink}
                  className="text-[var(--secondary-text)] hover:underline"
                >
                  Abrir no Planner →
                </a>
              </p>
            </div>
          </Reveal>

          {/* Semana de trabalho */}
          <Reveal className={SPAN_CLASS[6]}>
            <div className="group rounded-xl border border-[var(--line)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white transition-colors duration-200 group-hover:bg-[var(--secondary-light)]">
                  <BarChart3 size={19} className="text-[var(--ink)]" aria-hidden="true" />
                </span>
                <div>
                  <TituloCartao className="text-[18px] text-[var(--ink)]">
                    Sua semana de trabalho
                  </TituloCartao>
                  <p className="text-[13px] text-[var(--muted)]">tarefas concluídas por dia</p>
                </div>
              </div>
              {semanaVazia ? (
                /* Semana sem nenhuma conclusão desenhava 150px de altura com
                   quatro zeros e barras de 2px. Um gráfico que não desenha nada
                   é pior que uma frase que explica o que falta. */
                <div className="mt-5">
                  <p className="text-[14px] text-[var(--muted)]">
                    Nenhuma tarefa concluída nesta semana ainda. O gráfico aparece assim que a
                    primeira fechar.
                  </p>
                  <a
                    href={quadroPendentesLink}
                    className="mt-2 inline-block text-[13px] text-[var(--secondary-text)] no-underline hover:underline"
                  >
                    Abrir o Planner <span aria-hidden="true">→</span>
                  </a>
                </div>
              ) : (
                <div className="mt-5 flex h-[150px] items-end gap-2">
                  {dias.map((d, i) => {
                    const alturaPx = d.tarefas > 0 ? 10 + (d.tarefas / maxSemana) * 70 : 2;
                    return (
                      <div
                        key={i}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span
                          className="text-[13px] font-semibold text-[var(--ink)]"
                          style={{
                            opacity: barOn ? 1 : 0,
                            transition: reduce ? "none" : "opacity 300ms ease",
                          }}
                        >
                          {d.tarefas > 0 ? d.tarefas : d.isFuturo ? "" : "0"}
                        </span>
                        <span
                          className="w-full max-w-[72px] rounded-t-md"
                          style={{
                            height: barOn ? `${alturaPx}px` : "0px",
                            background: d.tarefas === 0 ? "var(--line)" : "var(--accent)",
                            border: d.isHoje ? "2px solid var(--ink)" : undefined,
                            borderBottom: d.isHoje ? "0" : undefined,
                            transition: reduce
                              ? "none"
                              : "height 600ms cubic-bezier(0.22,1,0.36,1)",
                          }}
                        />
                        <span
                          className={`text-[12px] ${d.isHoje ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}
                        >
                          {d.abrev}
                          {d.isHoje ? " · hoje" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Reveal>

          {/* Agenda: link pro calendário mensal (Planner + Google, quando conectado) */}
          <Reveal className={SPAN_CLASS[12]}>
            <a
              href={destino("/calendario", calendarioLiberado)}
              className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-white px-5 py-4 text-[14px] text-[var(--ink-soft)] no-underline transition-colors hover:border-[var(--secondary)]"
            >
              <span className="shrink-0 rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                Calendário
              </span>
              <span>
                Veja o mês inteiro: tarefas do Planner e, se conectar, seus compromissos do Google.
              </span>
              {calendarioLiberado ? (
                <span className="ml-auto shrink-0 text-[var(--secondary-text)]">Abrir →</span>
              ) : (
                <span className="ml-auto">
                  <SeloControle />
                </span>
              )}
            </a>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function GrupoTarefasPainel({
  titulo,
  corTitulo,
  itens,
  rotulo,
  corRotulo,
  destacarAte = 0,
  linkTarefa,
  link,
  linkTitulo,
  rotuloMais,
}: {
  titulo: string;
  corTitulo?: string;
  itens: TarefaRow[];
  rotulo: (t: TarefaRow) => string;
  /** Cor do prazo nos `destacarAte` primeiros itens; o resto fica em --muted. */
  corRotulo?: string;
  destacarAte?: number;
  linkTarefa: (t: TarefaRow) => string;
  link?: string;
  linkTitulo?: string;
  rotuloMais?: (n: number) => string;
}) {
  const visiveis = itens.slice(0, LIMITE_TAREFAS);
  const restantes = itens.length - visiveis.length;
  return (
    <div className="mb-3">
      {link ? (
        <a
          href={link}
          title={linkTitulo}
          className={`mb-1 inline-block text-[10px] font-semibold uppercase tracking-[0.14em] no-underline hover:underline ${
            corTitulo ?? "text-[var(--muted)] hover:text-[var(--ink-soft)]"
          }`}
        >
          {titulo} →
        </a>
      ) : (
        <p
          className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
            corTitulo ?? "text-[var(--muted)]"
          }`}
        >
          {titulo}
        </p>
      )}
      <ul>
        {visiveis.map((t, i) => (
          <li key={t.id} className="border-b border-[var(--line)] last:border-b-0">
            <a
              href={linkTarefa(t)}
              title="Abrir esta tarefa no Planner"
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-inherit no-underline transition-colors duration-150 hover:bg-[var(--secondary-light)]"
            >
              <span
                className="h-[18px] w-[18px] shrink-0 rounded-[5px] border-[1.5px] border-[var(--muted)]"
                aria-hidden="true"
              />
              <span className="flex-1 text-[15px] text-[var(--ink-soft)]">{t.titulo}</span>
              {/* Vermelho só nas mais antigas: 26 linhas em --danger não
                  informavam mais que 3, só pesavam mais. */}
              <span
                className={`shrink-0 text-[12px] ${
                  i < destacarAte ? (corRotulo ?? "text-[var(--muted)]") : "text-[var(--muted)]"
                }`}
              >
                {rotulo(t)}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {restantes > 0 && link && (
        <a
          href={link}
          className="mt-2 inline-block text-[13px] text-[var(--secondary-text)] no-underline hover:underline"
        >
          {rotuloMais ? rotuloMais(restantes) : `mais ${restantes} no Planner`}{" "}
          <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}
