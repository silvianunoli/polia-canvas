import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, GitFork } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { CAMPO_LABEL, MODULOS, TOTAL_MODULOS, ferramentaDe, secoesDoModulo } from "@/lib/planejamento";
import { MapaMental, type NoMapa } from "@/components/planejamento/MapaMental";
import { MODULO_ICONE, MODULO_SNIPPET_CAMPO } from "@/components/planejamento/modulosVisual";

export const Route = createFileRoute("/_authenticated/planejamento/")({
  head: () => ({
    meta: [
      { title: "Planejamento · Pólia" },
      {
        name: "description",
        content: "A base do seu negócio, construída por você, no seu ritmo.",
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
  component: PlanejamentoPage,
});

interface SecaoRow {
  secao: string;
  concluido: boolean;
}
interface CampoRow {
  campo: string;
  valor: string | null;
}
interface ProdutoRow {
  nome: string;
  tipo: string;
  canal: string | null;
  preco_venda: number;
  preco_custo: number | null;
}
interface MetaRow {
  titulo: string;
  valor_atual: number;
  valor_alvo: number | null;
  formato: string;
}
interface LancRow {
  tipo: string;
  valor: number;
  data: string;
}

type Vista = "documento" | "mapa";
const VISTA_KEY = "polia-planejamento-vista";

const TIPO_LABEL: Record<string, string> = {
  fisico: "Produto físico",
  digital: "Produto digital",
  servico: "Serviço",
};

// Extrai o primeiro número de um texto livre em pt-BR ("10 vendas" → 10,
// "R$ 2.500" → 2500). Usado só pra posicionar marcas num gráfico — não pra
// gravar dado, então o parse é best-effort.
function numeroDe(texto: string): number {
  const m = texto.match(/[\d.,]+/);
  if (!m) return 0;
  let s = m[0];
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  } else if (temPonto) {
    const partes = s.split(".");
    if (partes.length === 2 && partes[1].length === 3) s = partes.join("");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// ── Curadoria do output por módulo: cada bloco é um pedaço bespoke do
// documento (bento de cards, ou um dos widgets especiais por módulo). ──
type CardBento = { c: string; span: 3 | 4 | 6 | 8 | 12; tom?: "pink" };
type Bloco =
  | { t: "destaque"; c: string }
  | { t: "bento"; cards: CardBento[] }
  | { t: "produtos" }
  | { t: "metaTrack" }
  | { t: "canais" }
  | { t: "metasAtivas" }
  | { t: "timeline" }
  | { t: "primeiraAcao" };

const SPAN_CLASS: Record<number, string> = {
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  6: "col-span-12 sm:col-span-6",
  8: "col-span-12 sm:col-span-8",
  12: "col-span-12",
};

const GRID_COLS_SM: Record<number, string> = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

const LAYOUT: Record<number, Bloco[]> = {
  1: [
    { t: "destaque", c: "marca.proposito" },
    {
      t: "bento",
      cards: [
        { c: "marca.missao", span: 6 },
        { c: "marca.visao", span: 6 },
        { c: "marca.personalidade", span: 6, tom: "pink" },
        { c: "marca.tom", span: 6, tom: "pink" },
        { c: "marca.valores", span: 12 },
      ],
    },
  ],
  2: [
    { t: "destaque", c: "mercado.posicionamento" },
    {
      t: "bento",
      cards: [
        { c: "mercado.perfil_cliente", span: 8 },
        { c: "mercado.concorrentes", span: 4 },
        { c: "mercado.dores", span: 3 },
        { c: "mercado.sonhos", span: 3 },
        { c: "mercado.gatilhos", span: 3 },
        { c: "mercado.objecoes", span: 3 },
      ],
    },
  ],
  3: [
    { t: "destaque", c: "marca.frase_valor" },
    { t: "produtos" },
    {
      t: "bento",
      cards: [
        { c: "produto.transformacao", span: 12 },
        { c: "marca.fronteiras", span: 12 },
      ],
    },
  ],
  4: [
    { t: "metaTrack" },
    {
      t: "bento",
      cards: [
        { c: "financeiro.custo_fixo", span: 6 },
        { c: "financeiro.estrategia_preco", span: 6 },
        { c: "financeiro.custo_unitario", span: 6 },
        { c: "financeiro.preco_ideal", span: 6 },
      ],
    },
  ],
  5: [
    { t: "destaque", c: "caderno.bio" },
    { t: "canais" },
    {
      t: "bento",
      cards: [
        { c: "caderno.voz", span: 6 },
        { c: "caderno.jornada_cliente", span: 6 },
        { c: "caderno.anti_exemplos", span: 12 },
        { c: "caderno.link", span: 12 },
      ],
    },
  ],
  6: [
    { t: "destaque", c: "metas.visao_1ano" },
    { t: "metasAtivas" },
    { t: "timeline" },
    { t: "primeiraAcao" },
    {
      t: "bento",
      cards: [
        { c: "metas.metricas", span: 6 },
        { c: "metas.frequencia", span: 6 },
        { c: "metas.acoes", span: 6 },
        { c: "metas.cortes", span: 6 },
      ],
    },
  ],
};

function camposDoLayout(n: number): string[] {
  const out: string[] = [];
  for (const b of LAYOUT[n] ?? []) {
    if (b.t === "destaque") out.push(b.c);
    else if (b.t === "bento") out.push(...b.cards.map((c) => c.c));
    else if (b.t === "produtos") out.push("produto.lista");
    else if (b.t === "metaTrack")
      out.push("financeiro.meta_minima", "financeiro.meta_boa", "financeiro.meta_celebracao");
    else if (b.t === "canais") out.push("caderno.canais", "caderno.canal_principal");
    else if (b.t === "timeline")
      out.push("metas.meta_mes", "metas.meta_trimestre", "metas.meta_semestre", "metas.visao_3anos");
    else if (b.t === "primeiraAcao") out.push("metas.proxima_acao", "metas.data_proxima_acao");
  }
  return out;
}

// ── Hooks / helpers de motion ──
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

function FadeIn({ children }: { children: ReactNode }) {
  const reduce = usePrefersReducedMotion();
  const shown = useEntrada();
  if (reduce) return <div>{children}</div>;
  return (
    <div
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(10px)",
        transition:
          "opacity 220ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {children}
    </div>
  );
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

function PlanejamentoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const navigate = useNavigate();

  const [vista, setVista] = useState<Vista>("documento");
  const [scrollAlvo, setScrollAlvo] = useState<number | null>(null);

  // Restaura a última vista escolhida.
  useEffect(() => {
    try {
      const v = localStorage.getItem(VISTA_KEY);
      if (v === "mapa" || v === "documento") setVista(v);
    } catch {
      /* ignore */
    }
  }, []);
  const escolherVista = (v: Vista) => {
    setVista(v);
    try {
      localStorage.setItem(VISTA_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const dadosQuery = useQuery({
    queryKey: ["planejamento-mapa", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, secoesRes, camposRes, produtosRes, metasRes, lancRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, business_name, streak")
          .eq("id", userId!)
          .maybeSingle(),
        supabase.from("planejamento_secoes" as never).select("secao, concluido").eq("user_id", userId!),
        supabase.from("planejamento_campos" as never).select("campo, valor").eq("user_id", userId!),
        supabase
          .from("produtos")
          .select("nome, tipo, canal, preco_venda, preco_custo")
          .eq("user_id", userId!)
          .eq("arquivado", false),
        supabase
          .from("metas")
          .select("titulo, valor_atual, valor_alvo, formato")
          .eq("user_id", userId!)
          .eq("status", "ativa"),
        supabase.from("lancamentos").select("tipo, valor, data").eq("user_id", userId!),
      ]);
      return {
        profile: profileRes.data as
          | { full_name: string | null; business_name: string | null; streak: number | null }
          | null,
        secoes: ((secoesRes as unknown as { data: SecaoRow[] | null }).data ?? []) as SecaoRow[],
        campos: ((camposRes as unknown as { data: CampoRow[] | null }).data ?? []) as CampoRow[],
        produtos: (produtosRes.data ?? []) as unknown as ProdutoRow[],
        metas: (metasRes.data ?? []) as unknown as MetaRow[],
        lancamentos: (lancRes.data ?? []) as unknown as LancRow[],
      };
    },
  });

  const profile = dadosQuery.data?.profile;
  const initial = (profile?.full_name?.charAt(0) || "P").toUpperCase();
  const streak = profile?.streak ?? 0;
  const businessName = profile?.business_name?.trim() || "";
  const produtos = dadosQuery.data?.produtos ?? [];
  const metasAtivas = useMemo(() => (dadosQuery.data?.metas ?? []).slice(0, 3), [dadosQuery.data?.metas]);

  // Receita do mês corrente (calculado no cliente pra não divergir na hidratação SSR).
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  const receitaMes = useMemo(() => {
    if (!clientReady) return 0;
    const agora = new Date();
    // lancamentos.data é coluna DATE ("YYYY-MM-DD"). Comparar por prefixo, não via new Date():
    // "2026-07-01" viraria UTC meia-noite e em GMT-3 cairia no mês anterior, fazendo a venda
    // do dia 1º sumir da receita. Ver financeiro.tsx (mesAnoDe).
    const prefixoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    let receita = 0;
    for (const l of dadosQuery.data?.lancamentos ?? []) {
      if (l.tipo !== "entrada") continue;
      if (l.data?.startsWith(prefixoMes)) receita += Number(l.valor);
    }
    return receita;
  }, [dadosQuery.data?.lancamentos, clientReady]);

  const concluidas = useMemo(
    () => new Set((dadosQuery.data?.secoes ?? []).filter((s) => s.concluido).map((s) => s.secao)),
    [dadosQuery.data?.secoes],
  );
  const valorDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of dadosQuery.data?.campos ?? []) if (c.valor && c.valor.trim()) m.set(c.campo, c.valor);
    return m;
  }, [dadosQuery.data?.campos]);

  const moduloCompleto = (n: number) => secoesDoModulo(n).every((s) => concluidas.has(s.id));
  const moduloAtual = useMemo(() => {
    for (let n = 1; n <= TOTAL_MODULOS; n++) if (!moduloCompleto(n)) return n;
    return TOTAL_MODULOS + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concluidas]);
  const concluidosCount = MODULOS.filter((m) => moduloCompleto(m.n)).length;

  // Scroll spy (só na vista Documento).
  const [activeMod, setActiveMod] = useState<number | null>(null);
  useEffect(() => {
    if (vista !== "documento" || typeof window === "undefined") return;
    const els = MODULOS.map((m) => document.getElementById(`modulo-${m.n}`)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveMod(Number(vis[0].target.id.split("-")[1]));
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [dadosQuery.data, vista]);

  // Ao voltar do mapa pra um módulo concluído, rola até a seção.
  useEffect(() => {
    if (vista !== "documento" || scrollAlvo == null) return;
    const t = window.setTimeout(() => {
      document.getElementById(`modulo-${scrollAlvo}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollAlvo(null);
    }, 80);
    return () => window.clearTimeout(t);
  }, [vista, scrollAlvo]);

  const irParaModulo = (n: number) =>
    navigate({ to: "/planejamento/modulo/$n", params: { n: String(n) } });

  const onClickChip = (n: number) => {
    if (moduloCompleto(n)) {
      document.getElementById(`modulo-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (n === moduloAtual) {
      irParaModulo(n);
    }
  };

  const val = (c: string) => valorDe.get(c);

  const nosMapa: NoMapa[] = MODULOS.map((m) => ({
    n: m.n,
    nome: m.nome,
    concluido: moduloCompleto(m.n),
    snippet: valorDe.get(MODULO_SNIPPET_CAMPO[m.n]) ?? "",
    ferramentaNome: ferramentaDe(m.n).nome,
    ferramentaRota: ferramentaDe(m.n).rota,
  }));

  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PainelNav initial={initial} streak={streak} navActive="/planejamento" />

      {/* Cabeçalho + toggle de vista */}
      <div className="mx-auto max-w-[860px] px-6 pt-12 md:px-10 md:pt-16">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
              Planejamento
            </p>
            <h1 className="font-fraunces mt-1 text-[clamp(28px,6vw,48px)] leading-[1.1] text-[var(--ink)]">
              {businessName || "A base do seu negócio."}
            </h1>
            <p className="mt-2 text-[17px] text-[var(--ink-soft)]">
              {businessName ? "Seu planejamento de negócio." : "Construída por você, no seu ritmo."}
            </p>
          </div>

          <div className="inline-flex shrink-0 rounded-lg border border-[var(--line)] bg-white p-[3px]">
            {(["documento", "mapa"] as const).map((v) => {
              const ativo = vista === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => escolherVista(v)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition-colors duration-200 ${
                    ativo
                      ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                      : "text-[var(--ink-soft)] hover:bg-[var(--secondary-light)]"
                  }`}
                  style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
                >
                  {v === "documento" ? (
                    <FileText size={16} aria-hidden="true" />
                  ) : (
                    <GitFork size={16} aria-hidden="true" />
                  )}
                  {v === "documento" ? "Documento" : "Mapa"}
                </button>
              );
            })}
          </div>
        </header>
      </div>

      {vista === "mapa" ? (
        <div className="mx-auto max-w-[1100px] px-6 pb-16 md:px-10">
          <FadeIn key="mapa">
            <MapaMental
              nodes={nosMapa}
              businessName={businessName}
              concluidos={concluidosCount}
              total={TOTAL_MODULOS}
              onAbrirConcluido={(n) => {
                escolherVista("documento");
                setScrollAlvo(n);
              }}
              onAbrirModulo={irParaModulo}
            />
          </FadeIn>
        </div>
      ) : (
        <FadeIn key="documento">
          {/* Faixa horizontal dos 6 módulos (sticky) */}
          <div className="sticky top-14 z-10 border-y border-[var(--line)] bg-[var(--bg)] md:top-0">
            <div className="mx-auto max-w-[860px] px-6 py-3 md:px-10">
              <div className="flex gap-3 overflow-x-auto md:justify-between md:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {MODULOS.map((m) => {
                  const secoes = secoesDoModulo(m.n);
                  const feitas = secoes.filter((s) => concluidas.has(s.id)).length;
                  const completo = moduloCompleto(m.n);
                  const atual = m.n === moduloAtual;
                  const emAndamento = atual && feitas > 0;
                  const bloqueado = m.n > moduloAtual;
                  const clicavel = completo || atual;
                  const Icone = MODULO_ICONE[m.n];
                  return (
                    <button
                      key={m.n}
                      type="button"
                      onClick={() => onClickChip(m.n)}
                      disabled={!clicavel}
                      aria-label={`Módulo ${m.n}: ${m.nome}`}
                      className={`flex w-[124px] shrink-0 flex-col items-center gap-1.5 rounded-lg px-2 py-1 text-center transition-[transform,background] duration-200 md:w-auto md:flex-1 ${
                        clicavel ? "cursor-pointer hover:-translate-y-0.5 hover:bg-white" : "cursor-default"
                      } ${
                        m.n === activeMod
                          ? "ring-1 ring-[var(--secondary)]"
                          : clicavel
                            ? "ring-1 ring-transparent hover:ring-[var(--line)]"
                            : "ring-1 ring-transparent"
                      }`}
                      style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
                    >
                      {completo ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)]">
                          <Icone size={13} className="text-white" aria-hidden="true" />
                        </span>
                      ) : (
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg)]"
                          style={{ border: emAndamento ? "2px solid var(--secondary)" : "1px solid var(--line)" }}
                        >
                          <span
                            className={`font-fraunces text-[12px] ${
                              emAndamento ? "text-[var(--secondary-text)]" : "text-[var(--muted)]"
                            }`}
                          >
                            {m.n}
                          </span>
                        </span>
                      )}
                      <span
                        className={`text-[0.8125rem] leading-tight ${
                          m.n === activeMod
                            ? "font-semibold text-[var(--secondary-text)]"
                            : completo || emAndamento
                              ? "font-medium text-[var(--ink)]"
                              : bloqueado
                                ? "text-[var(--muted)]"
                                : "text-[var(--ink-soft)]"
                        }`}
                      >
                        {m.nome}
                      </span>
                      {completo ? (
                        <span className="text-[11px] text-[var(--muted)]">concluído</span>
                      ) : emAndamento ? (
                        <span className="text-[11px] text-[var(--secondary-text)]">
                          seção {feitas} de {secoes.length}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Outputs dos módulos */}
          <div className="mx-auto max-w-[860px] px-6 pb-16 md:px-10">
            <div className="mt-10 space-y-10">
              {MODULOS.map((m) => {
                const ferramenta = ferramentaDe(m.n);
                const temAlgo =
                  camposDoLayout(m.n).some((c) => valorDe.has(c)) ||
                  (m.n === 3 && produtos.length > 0) ||
                  (m.n === 6 && metasAtivas.length > 0);
                const proximo = m.n === moduloAtual;
                const Icone = MODULO_ICONE[m.n];
                return (
                  <Reveal key={m.n}>
                    <section id={`modulo-${m.n}`} className="group scroll-mt-24 border-t border-[var(--line)] pt-8">
                      {/* Header do módulo */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white transition-[background,transform] duration-200 group-hover:-rotate-[4deg] group-hover:bg-[var(--secondary-light)]">
                            <Icone size={20} className="text-[var(--ink)]" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                              Módulo {m.n} · {m.nome}
                            </p>
                            {temAlgo && (
                              <a
                                href={ferramenta.rota}
                                className="mt-1 inline-block rounded-full bg-[var(--secondary-light)] px-2.5 py-1 text-[11px] font-medium text-[var(--secondary-text)] no-underline hover:opacity-90"
                              >
                                → {ferramenta.nome}
                              </a>
                            )}
                          </div>
                        </div>
                        {temAlgo && (
                          <a
                            href={`/planejamento/modulo/${m.n}`}
                            className="shrink-0 text-[0.875rem] text-[var(--secondary-text)] hover:underline"
                          >
                            Editar módulo →
                          </a>
                        )}
                      </div>

                      {temAlgo ? (
                        <div className="mt-5">
                          {(LAYOUT[m.n] ?? []).map((b, i) => (
                            <BlocoView
                              key={i}
                              bloco={b}
                              val={val}
                              produtos={produtos}
                              metasAtivas={metasAtivas}
                              receitaMes={receitaMes}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3">
                          <p className="text-[0.9rem] text-[var(--muted)]">
                            Você ainda não preencheu este módulo.
                          </p>
                          {proximo ? (
                            <a
                              href={`/planejamento/modulo/${m.n}`}
                              className="mt-3 inline-block rounded-full bg-[var(--secondary)] px-5 py-2.5 text-[14px] font-medium text-[var(--secondary-ink)] no-underline transition-opacity hover:opacity-90"
                            >
                              Começar agora →
                            </a>
                          ) : (
                            <p className="mt-2 text-[0.875rem] text-[var(--muted)]">
                              Disponível após concluir o Módulo {m.n - 1}.
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  </Reveal>
                );
              })}
            </div>

            {moduloAtual > TOTAL_MODULOS && (
              <div className="mt-12 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6 text-center">
                <p className="font-fraunces text-[1.25rem] leading-snug text-[var(--ink)]">
                  Seu planejamento está completo.
                </p>
                <p className="mt-1 text-[0.9rem] text-[var(--ink-soft)]">Agora coloca em prática.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {[
                    { rota: "/produtos", nome: "Catálogo" },
                    { rota: "/financeiro", nome: "Financeiro" },
                    { rota: "/metas", nome: "Metas" },
                  ].map((f) => (
                    <a
                      key={f.rota}
                      href={f.rota}
                      className="rounded-full bg-[var(--secondary)] px-4 py-2 text-[13px] font-medium text-[var(--secondary-ink)] no-underline transition-opacity hover:opacity-90"
                    >
                      {f.nome} →
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function Rotulo({ campo }: { campo: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
      {CAMPO_LABEL[campo] ?? campo}
    </p>
  );
}

function BlocoView({
  bloco,
  val,
  produtos,
  metasAtivas,
  receitaMes,
}: {
  bloco: Bloco;
  val: (c: string) => string | undefined;
  produtos: ProdutoRow[];
  metasAtivas: MetaRow[];
  receitaMes: number;
}) {
  if (bloco.t === "destaque") {
    const v = val(bloco.c);
    if (!v) return null;
    return (
      <div className="mb-8 max-w-[30em] border-l-[3px] border-[var(--secondary)] pl-6">
        <Rotulo campo={bloco.c} />
        <p className="font-fraunces mt-1 whitespace-pre-line text-[26px] leading-[1.35] text-[var(--ink)]">
          {v}
        </p>
      </div>
    );
  }

  if (bloco.t === "bento") {
    const cards = bloco.cards.filter((c) => val(c.c));
    if (cards.length === 0) return null;
    return (
      <div className="mb-8 grid grid-cols-12 gap-4">
        {cards.map((c) => (
          <div
            key={c.c}
            className={`${SPAN_CLASS[c.span]} rounded-xl border border-[var(--line)] p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)] ${
              c.tom === "pink" ? "bg-[var(--surface)]" : "bg-white"
            }`}
          >
            <Rotulo campo={c.c} />
            <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-soft)]">
              {val(c.c)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (bloco.t === "produtos") {
    if (produtos.length === 0) {
      const lista = val("produto.lista");
      if (!lista) return null;
      return (
        <div className="mb-8 rounded-xl border border-[var(--line)] bg-white p-5">
          <Rotulo campo="produto.lista" />
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-soft)]">{lista}</p>
        </div>
      );
    }
    return (
      <div className="mb-8 grid grid-cols-12 gap-4">
        {produtos.map((p) => (
          <ProductCard key={`${p.nome}-${p.preco_venda}`} produto={p} />
        ))}
      </div>
    );
  }

  if (bloco.t === "metaTrack") {
    return (
      <MetaTrack
        minima={val("financeiro.meta_minima")}
        boa={val("financeiro.meta_boa")}
        celebracao={val("financeiro.meta_celebracao")}
        agora={receitaMes}
      />
    );
  }

  if (bloco.t === "canais") {
    return <CanalChips canaisTexto={val("caderno.canais")} canalPrincipal={val("caderno.canal_principal")} />;
  }

  if (bloco.t === "metasAtivas") {
    if (metasAtivas.length === 0) return null;
    return (
      <div className="mb-8 rounded-[var(--radius-md)] bg-[var(--surface)] p-6">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Suas metas ativas agora
        </p>
        {metasAtivas.map((m) => (
          <GoalRow key={m.titulo} nome={m.titulo} atual={m.valor_atual} alvo={m.valor_alvo ?? 0} formato={m.formato} />
        ))}
      </div>
    );
  }

  if (bloco.t === "timeline") {
    const steps = (
      [
        { quando: "Próximo mês", texto: val("metas.meta_mes") },
        { quando: "3 meses", texto: val("metas.meta_trimestre") },
        { quando: "6 meses", texto: val("metas.meta_semestre") },
        { quando: "3 anos", texto: val("metas.visao_3anos") },
      ] as { quando: string; texto?: string }[]
    ).filter((s): s is { quando: string; texto: string } => !!s.texto);
    return <Timeline steps={steps} />;
  }

  if (bloco.t === "primeiraAcao") {
    const acao = val("metas.proxima_acao");
    if (!acao) return null;
    return <FirstAction acao={acao} data={val("metas.data_proxima_acao")} />;
  }

  return null;
}

function ProductCard({ produto }: { produto: ProdutoRow }) {
  const shown = useEntrada();
  const custo = produto.preco_custo ?? 0;
  const margem =
    produto.preco_venda > 0 ? Math.max(0, Math.round(((produto.preco_venda - custo) / produto.preco_venda) * 100)) : 0;
  const recorrente = /assinatura/i.test(produto.canal ?? "");
  return (
    <div className="col-span-12 rounded-xl border border-[var(--line)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[0_4px_12px_rgba(10,10,10,0.08)] sm:col-span-6 lg:col-span-3">
      <p className="font-fraunces text-[19px] leading-tight text-[var(--ink)]">{produto.nome}</p>
      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
        {TIPO_LABEL[produto.tipo] ?? produto.tipo}
        {produto.canal ? ` · ${produto.canal}` : ""}
      </p>
      <p className="font-fraunces mt-3 text-[24px] text-[var(--ink)]">
        R$ {produto.preco_venda.toLocaleString("pt-BR")}
        {recorrente && <span className="text-[14px] text-[var(--muted)]">/mês</span>}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full rounded-full bg-[var(--secondary)]"
          style={{ width: shown ? `${margem}%` : "0%", transition: "width 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-[var(--muted)]">
        custo R$ {custo.toLocaleString("pt-BR")} · margem {margem}%
      </p>
    </div>
  );
}

const META_MARCAS: { campo: string; curto: string }[] = [
  { campo: "financeiro.meta_minima", curto: "mínimo" },
  { campo: "financeiro.meta_boa", curto: "mês bom" },
  { campo: "financeiro.meta_celebracao", curto: "comemorar" },
];

function MetaTrack({
  minima,
  boa,
  celebracao,
  agora,
}: {
  minima?: string;
  boa?: string;
  celebracao?: string;
  agora: number;
}) {
  const shown = useEntrada();
  const textos: Record<string, string | undefined> = {
    "financeiro.meta_minima": minima,
    "financeiro.meta_boa": boa,
    "financeiro.meta_celebracao": celebracao,
  };
  const marcas = META_MARCAS.map((m) => ({ ...m, texto: textos[m.campo] })).filter(
    (m): m is { campo: string; curto: string; texto: string } => !!m.texto,
  );
  if (marcas.length === 0) return null;
  const valores = marcas.map((m) => numeroDe(m.texto));
  const max = Math.max(...valores, agora, 1);
  const pct = (v: number) => Math.min(99, Math.max(0, (v / max) * 100));

  return (
    <div className="mb-8 rounded-[var(--radius-md)] bg-[var(--surface)] p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Onde você está agora
      </p>
      <div className="relative mx-1 my-9 h-3.5 rounded-lg border border-[var(--line)] bg-white">
        <div
          className="absolute inset-y-0 left-0 rounded-lg bg-[var(--secondary)]"
          style={{ width: shown ? `${pct(agora)}%` : "0%", transition: "width 800ms cubic-bezier(0.22,1,0.36,1)" }}
        />
        {marcas.map((m, i) => {
          const v = valores[i];
          const ultimo = i === marcas.length - 1;
          return (
            <div
              key={m.campo}
              className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-[var(--ink)]"
              style={{ left: `${pct(v)}%` }}
            >
              <span
                className="absolute -top-9 whitespace-nowrap rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-soft)]"
                style={ultimo ? { right: 0 } : { left: "50%", transform: "translateX(-50%)" }}
              >
                {m.curto} · {m.texto}
              </span>
            </div>
          );
        })}
        <span
          className="absolute top-6 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--highlight)] px-2 py-0.5 text-[12px] font-semibold text-[var(--highlight-ink)]"
          style={{ left: `${pct(agora)}%` }}
        >
          R$ {agora.toLocaleString("pt-BR")} agora
        </span>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${GRID_COLS_SM[marcas.length] ?? "sm:grid-cols-3"}`}>
        {marcas.map((m, i) => (
          <div
            key={m.campo}
            className="rounded-lg border bg-white p-4"
            style={{ borderColor: i === marcas.length - 1 ? "var(--secondary)" : "var(--line)" }}
          >
            <Rotulo campo={m.campo} />
            <p className="font-fraunces mt-1 text-[24px] leading-none text-[var(--ink)]">{m.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CanalChips({ canaisTexto, canalPrincipal }: { canaisTexto?: string; canalPrincipal?: string }) {
  if (!canaisTexto) return null;
  const [listaBruta, ...resto] = canaisTexto.split(/\n\s*\n/);
  const extra = resto.join("\n\n").trim();
  const nomes = Array.from(
    new Set(
      listaBruta
        .split(/,| e (?=[A-ZÀ-Ý])/)
        .map((s) => s.trim().replace(/\.$/, ""))
        .filter(Boolean),
    ),
  );
  if (nomes.length === 0) return null;
  const principalLower = (canalPrincipal ?? "").toLowerCase();
  return (
    <div className="mb-6">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Seus canais</p>
      <div className="flex flex-wrap gap-2">
        {nomes.map((nome) => {
          const prio = principalLower.includes(nome.toLowerCase());
          return (
            <span
              key={nome}
              className={`rounded-lg border px-3 py-1.5 text-[13px] transition-colors duration-150 ${
                prio
                  ? "border-[var(--accent)] bg-[var(--surface-pink)] font-medium text-[var(--accent-ink)]"
                  : "border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--secondary)] hover:bg-[var(--secondary-light)]"
              }`}
            >
              {nome}
              {prio ? " · prioritário" : ""}
            </span>
          );
        })}
      </div>
      {extra && <p className="mt-3 text-[13px] leading-relaxed text-[var(--ink-soft)]">{extra}</p>}
    </div>
  );
}

function GoalRow({
  nome,
  atual,
  alvo,
  formato,
}: {
  nome: string;
  atual: number;
  alvo: number;
  formato: string;
}) {
  const shown = useEntrada();
  const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 0;
  const fmt = (v: number) => (formato === "moeda" ? `R$ ${v.toLocaleString("pt-BR")}` : v.toLocaleString("pt-BR"));
  return (
    <div className="mb-4 flex items-center gap-4 last:mb-0">
      <span className="w-[130px] shrink-0 text-[14px] text-[var(--ink-soft)] sm:w-[220px]">{nome}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-md border border-[var(--line)] bg-white">
        <span
          className="block h-full rounded-md bg-[var(--accent)]"
          style={{ width: shown ? `${pct}%` : "0%", transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </span>
      <span className="w-[110px] shrink-0 text-right text-[13px] tabular-nums text-[var(--ink-soft)]">
        {fmt(atual)} de {fmt(alvo)}
      </span>
    </div>
  );
}

function Timeline({ steps }: { steps: { quando: string; texto: string }[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:gap-0">
      {steps.map((s) => (
        <div
          key={s.quando}
          className="group relative border-l-2 border-[var(--line)] pl-4 sm:border-l-0 sm:border-t-2 sm:pr-4 sm:pl-0 sm:pt-4"
        >
          <span className="absolute -left-[5px] top-0 h-[10px] w-[10px] rounded-full border-2 border-[var(--muted)] bg-[var(--bg)] transition-colors duration-200 group-hover:border-[var(--secondary)] group-hover:bg-[var(--secondary-light)] sm:-top-[5px] sm:left-0" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{s.quando}</p>
          <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-[var(--ink-soft)]">{s.texto}</p>
        </div>
      ))}
    </div>
  );
}

function FirstAction({ acao, data }: { acao: string; data?: string }) {
  return (
    <div className="mt-8 flex items-baseline justify-between gap-4 rounded-r-lg border-l-[3px] border-[var(--secondary)] bg-white py-3 pl-4 pr-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Sua primeira ação</p>
        <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-[var(--ink-soft)]">{acao}</p>
      </div>
      {data && <span className="shrink-0 text-[13px] text-[var(--muted)]">{data}</span>}
    </div>
  );
}
