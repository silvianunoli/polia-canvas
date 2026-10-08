import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, BarChart3, Check, Lock } from "lucide-react";
import { toastErro } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { Vazio } from "@/components/layout/Vazio";
import { TOTAL_MODULOS, moduloInfo, secoesDoModulo } from "@/lib/planejamento";
import { hojeISO, ehMesAtual, mesAnoDe } from "@/lib/data.functions";
import { buscarMetaDoMes } from "@/lib/metaDoMes";
import { intervaloDoMes, lerTodasAsPaginas } from "@/lib/leituraPaginada";
import { rotaLiberada } from "@/lib/planos";
import { ModalLancamento, type Lancamento } from "@/components/financeiro/ModalLancamento";
import { RegistroDoMes } from "@/components/financeiro/RegistroDoMes";
import { BlockError } from "@/components/ui/BlockError";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { TourBoasVindas } from "@/components/dicas/TourBoasVindas";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel · Pólia One" },
      {
        name: "description",
        content: "Seu painel da Pólia One: o próximo módulo, seu dia e o ar do seu negócio.",
      },
    ],
  }),
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

// Quantas tarefas cada grupo mostra antes de mandar pro Planner. Sem teto, uma
// usuária com 26 atrasadas ganhava um cartão de 1.328px e uma parede vermelha
// na abertura do painel.
const LIMITE_TAREFAS = 5;

// Intenção do dia é uma frase, não um texto (QA-17: o campo não tinha limite).
// Cabe folgado o exemplo do placeholder e não estoura a linha do cabeçalho.
const LIMITE_INTENCAO = 160;

function upgradeHref(rota: string) {
  return `/upgrade?rota=${encodeURIComponent(rota)}&tier=controle`;
}

/**
 * Selo de bloqueio, na mesma linguagem do cadeado da barra lateral. Existe
 * porque o painel mostrava métrica de página fechada sem nenhum aviso: a
 * usuária do plano Grátis clicava em "Quanto sobrou" e caía no /upgrade sem saber
 * por quê.
 */
function SeloControle() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-accent font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
      <Lock size={10} aria-hidden="true" />
      no Premium
    </span>
  );
}

/**
 * Rótulo de cartão. É <h2> pra dar sumário à página (o painel inteiro tinha um
 * único heading), mas mantém `font-sans`: Cabinet Grotesk é a face de display,
 * restrita a texto grande e curto, e ficaria errada em caixa alta de 10px.
 */
function TituloCartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={className || "font-sans"}>{children}</h2>;
}

/**
 * Cartão de número do mês. Vira link só pra quem tem a tela /financeiro; sem
 * ela, o cartão é um cartão e pronto.
 *
 * Existe desde 03/09/2026 (COPY-04). Antes, os três cartões de dinheiro
 * apontavam pro /upgrade quando o plano era Grátis, porque o número era um
 * cadeado. Agora o número é real em todo plano (o registro de entrada e saída
 * abriu), e mandar quem acabou de ver o próprio dinheiro pra uma tela de venda
 * seria um pedágio, não uma navegação.
 */
function CartaoFinanceiro({
  href,
  padding = "p-5",
  children,
}: {
  href?: string;
  padding?: string;
  children: ReactNode;
}) {
  const base = `block rounded-xl border border-[var(--line)] bg-[var(--surface)] ${padding}`;
  if (!href) return <div className={base}>{children}</div>;
  return (
    <LinkInterno
      href={href}
      className={`group ${base} no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[var(--secondary)] hover:shadow-[var(--shadow-card-hover)]`}
    >
      {children}
    </LinkInterno>
  );
}

interface SecaoRow {
  secao: string;
  concluido: boolean;
}
interface CampoRow {
  campo: string;
  valor: string | null;
}
// Os números do mês precisam só de tipo/valor/data, mas o cartão "Entrou e saiu
// este mês" (COPY-04) lista e corrige lançamento, então lê a linha inteira —
// mesmo formato do modal compartilhado.
type LancRow = Lancamento;
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

function PainelPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const qc = useQueryClient();

  // O painel exibia métrica de rota que o plano Grátis não abre (Financeiro,
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
      const { ano, mes } = mesAnoDe(hoje);
      const mesCorrente = intervaloDoMes(ano, mes);
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
          // meta_minima entrou em 03/09/2026 (COPY-04): é o "mínimo pra fechar
          // as contas" que a landing promete no painel diário, e ele é
          // respondido no módulo 4 do Planejamento, que o plano Grátis tem.
          .in("campo", ["financeiro.meta_minima", "financeiro.meta_celebracao"]),
        // Meta do mês: fonte única (mesma que Financeiro e a calculadora de Produtos lêem).
        // A escolha entre linhas repetidas/arquivadas mora em buscarMetaDoMes (QA-19).
        buscarMetaDoMes(supabase, userId!),
        // Só o mês corrente, e lido inteiro (QA-24): sem filtro, o PostgREST
        // cortava em 1.000 linhas e os totais do mês ficavam errados sem aviso.
        // Tudo o que o Painel e o RegistroDoMes mostram é do mês corrente.
        lerTodasAsPaginas<LancRow>((de, ate) =>
          supabase
            .from("lancamentos")
            .select("id, tipo, valor, data, descricao, categoria, created_at")
            .eq("user_id", userId!)
            .gte("data", mesCorrente.inicio)
            .lt("data", mesCorrente.fimExclusivo)
            .order("data", { ascending: false })
            .order("id", { ascending: true })
            .range(de, ate)
            .then((r) => ({ data: r.data as unknown as LancRow[] | null, error: r.error })),
        ).then(
          (data) => ({ data, error: null as unknown }),
          (error: unknown) => ({ data: null, error }),
        ),
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
      // Leitura que falha não pode virar R$ 0: a tela de dinheiro mentiria.
      const falha = [
        profileRes,
        secoesRes,
        camposRes,
        metaMesRes,
        lancRes,
        clientesRes,
        quadrosRes,
        tarefasRes,
        intencaoRes,
      ].find((r) => (r as { error: unknown }).error);
      if (falha) throw (falha as { error: unknown }).error;
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
  // O mínimo pra fechar as contas do mês. Mesma fonte que a régua do Financeiro
  // (planejamento_campos), que é do Planejamento e não do plano pago.
  const metaMinima = useMemo(() => {
    const v = campoValor.get("financeiro.meta_minima");
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
  const quadros = useMemo(() => dados?.quadros ?? [], [dados?.quadros]);
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
    // A manchete do plano Grátis era um desvio pro Planejamento, porque sem
    // Financeiro a receita era sempre 0 e "registre sua primeira venda" mandava
    // fazer o que o plano não deixava. Desde 03/09/2026 (COPY-04) todo plano
    // registra entrada e saída pelo cartão "Entrou e saiu este mês", então a
    // manchete volta a ser a mesma pra todo mundo: o número do mês, que é o que
    // a landing promete no card do grátis.
    if (receitaMes <= 0) {
      return "Nenhuma venda registrada este mês. A primeira entrada já mostra quanto sobra.";
    }
    // "Quanto falta pra fechar as contas do mês" é literalmente o que a landing
    // promete no painel diário, e o número vem do módulo 4 do Planejamento
    // (financeiro.meta_minima). Vem antes da Meta do mês porque pagar as contas
    // é a primeira pergunta: mês bom só faz sentido depois dela.
    if (metaMinima > 0 && receitaMes < metaMinima) {
      return (
        <>
          Faltam <span className="whitespace-nowrap">{fmtBRL(metaMinima - receitaMes)}</span> pra
          fechar as contas do mês.
        </>
      );
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
  }, [receitaMes, metaBoa, metaMinima]);

  // A manchete nomeava a próxima ação e a tela não oferecia nada clicável: era
  // uma pergunta sem botão. Os dados que escolhem o texto já estavam todos
  // calculados aqui.
  //
  // Sem o Financeiro (Grátis), a ação não é mais um desvio pro Planejamento
  // nem um link pro /upgrade: é o registro em si, no modal do próprio Painel
  // (COPY-04). O que o Premium abre segue dito no rodapé do cartão de
  // registro, não no botão principal.
  const acaoPrincipal = useMemo((): { texto: string; href?: string; abreRegistro?: boolean } => {
    if (!financeiroLiberado) {
      return {
        texto: receitaMes <= 0 ? "Registrar uma entrada" : "Registrar entrada ou saída",
        abreRegistro: true,
      };
    }
    if (receitaMes <= 0) return { texto: "Registrar uma entrada", href: "/financeiro" };
    return { texto: "Abrir o Financeiro", href: "/financeiro" };
  }, [financeiroLiberado, receitaMes]);

  // Modal de registro disparado pelo botão da manchete. Fica separado do estado
  // interno do cartão "Entrou e saiu este mês" de propósito: os dois usam o
  // mesmo componente e a mesma invalidação, e nenhum precisa conhecer o outro.
  const [registroAberto, setRegistroAberto] = useState(false);

  // ── Semana de trabalho (tarefas concluídas por dia) ──
  const [saudacao, setSaudacao] = useState("Olá");
  useEffect(() => setSaudacao(getSaudacao()), []);

  // ── Intenção do dia (persiste por dia; se ficar vazia, fica em silêncio) ──
  const [editandoIntencao, setEditandoIntencao] = useState(false);
  const [rascunhoIntencao, setRascunhoIntencao] = useState("");
  const intencaoSalva = dados?.intencao ?? null;
  const inputIntencaoRef = useRef<HTMLInputElement>(null);
  const botaoEditarIntencaoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!editandoIntencao) setRascunhoIntencao(intencaoSalva ?? "");
  }, [intencaoSalva, editandoIntencao]);
  // Enter/Escape desmontam o <input> (vira <span> + botão "Editar intenção") e,
  // sem isso, o foco caía pro <body>. O input é focado ao entrar em modo edição;
  // o botão "Editar intenção" é focado ao sair, depois que o novo elemento
  // existe no DOM (por isso o requestAnimationFrame nos handlers abaixo).
  useEffect(() => {
    if (editandoIntencao) inputIntencaoRef.current?.focus();
  }, [editandoIntencao]);

  // QA-17 (08/10/2026): o modo edição fechava ANTES do upsert responder. Ao
  // fechar, o efeito acima trocava o rascunho pelo valor velho, então quando a
  // gravação falhava o texto novo sumia e a tela mostrava a intenção antiga.
  // Agora o campo só fecha depois de gravado; se falhar, o texto fica no campo.
  const [salvandoIntencao, setSalvandoIntencao] = useState(false);
  const salvarIntencao = async () => {
    const texto = rascunhoIntencao.trim().slice(0, LIMITE_INTENCAO);
    if (!texto || !userId || salvandoIntencao) return;
    setSalvandoIntencao(true);
    const { error } = await supabase
      .from("intencoes_dia" as never)
      .upsert(
        { user_id: userId, data: hojeISO(), texto, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id,data" },
      );
    setSalvandoIntencao(false);
    if (error) {
      toastErro(
        "A Pólia One não conseguiu guardar sua intenção. Tenta de novo, o texto continua no campo.",
      );
      requestAnimationFrame(() => inputIntencaoRef.current?.focus());
      return;
    }
    // O cache recebe o texto novo antes de sair do modo edição, senão o efeito
    // do rascunho piscaria o valor velho até o refetch chegar.
    qc.setQueryData(["painel-dados", userId], (antigo: typeof dados) =>
      antigo ? { ...antigo, intencao: texto } : antigo,
    );
    setEditandoIntencao(false);
    // Enter/check desmontam o <input>; o foco vai pro botão "Editar intenção"
    // depois que ele existe no DOM.
    requestAnimationFrame(() => botaoEditarIntencaoRef.current?.focus());
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
      <TourBoasVindas />
      <div className="mx-auto w-full max-w-[1120px] px-6 pb-24 pt-16 md:px-10">
        {/* Header: primeira dobra, sem reveal */}
        <div>
          <p className="font-fraunces text-[19px] italic text-[var(--ink-soft)]">
            {saudacao}, {meta.displayName}.
          </p>
          <h1 className="font-cabinet mt-2 max-w-[22em] text-[clamp(28px,5vw,44px)] leading-[1.12] text-[var(--ink)]">
            {dadosQuery.isSuccess ? (
              headline
            ) : dadosQuery.isError ? (
              "O Painel não carregou agora."
            ) : (
              <span
                aria-hidden="true"
                className="block h-[1.1em] w-[70%] animate-pulse rounded-lg bg-[var(--line)] motion-reduce:animate-none"
              />
            )}
          </h1>

          {acaoPrincipal.href ? (
            <LinkInterno
              href={acaoPrincipal.href}
              data-tour="acao-principal"
              className={`${BTN_ACAO} mt-5`}
            >
              {acaoPrincipal.texto}
              <span aria-hidden="true">→</span>
            </LinkInterno>
          ) : (
            <button
              type="button"
              onClick={() => setRegistroAberto(true)}
              data-tour="acao-principal"
              className={`${BTN_ACAO} mt-5`}
            >
              {acaoPrincipal.texto}
              <span aria-hidden="true">→</span>
            </button>
          )}

          {/* Intenção do dia */}
          <div className="mt-6 max-w-[560px]">
            <p
              id="intencao-dia-rotulo"
              className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]"
            >
              {intencaoSalva && !editandoIntencao
                ? "Intenção de hoje"
                : "Qual é a sua intenção pra hoje?"}
            </p>
            {editandoIntencao || !intencaoSalva ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={inputIntencaoRef}
                  type="text"
                  value={rascunhoIntencao}
                  onChange={(e) => setRascunhoIntencao(e.target.value)}
                  maxLength={LIMITE_INTENCAO}
                  readOnly={salvandoIntencao}
                  aria-busy={salvandoIntencao || undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void salvarIntencao();
                    if (e.key === "Escape" && intencaoSalva) {
                      setEditandoIntencao(false);
                      requestAnimationFrame(() => botaoEditarIntencaoRef.current?.focus());
                    }
                  }}
                  placeholder="Ex: gravar a aula e não abrir o Instagram até o almoço"
                  aria-labelledby="intencao-dia-rotulo"
                  className="h-11 flex-1 rounded-lg border border-[var(--line)] px-3 text-[14px] text-[var(--ink-soft)] focus:border-[var(--secondary-text)]"
                />
                <button
                  type="button"
                  onClick={() => void salvarIntencao()}
                  disabled={salvandoIntencao}
                  aria-label={salvandoIntencao ? "Guardando intenção" : "Guardar intenção"}
                  title="Guardar intenção"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[var(--ink)] bg-[var(--secondary)] text-[var(--secondary-ink)] transition-transform duration-150 hover:-translate-y-px disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <Check size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span className="min-w-0 break-words font-fraunces text-[19px] italic text-[var(--ink-soft)]">
                  {intencaoSalva}
                </span>
                <button
                  ref={botaoEditarIntencaoRef}
                  type="button"
                  onClick={() => {
                    setRascunhoIntencao(intencaoSalva ?? "");
                    setEditandoIntencao(true);
                  }}
                  aria-label="Editar intenção"
                  title="Editar intenção"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--secondary-light)] hover:text-[var(--ink)]"
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>

        {dadosQuery.isError ? (
          <div className="mt-8" role="alert">
            <BlockError
              message="A Pólia One não conseguiu ler os seus números agora. Nada foi perdido, é só a leitura que falhou."
              onRetry={() => dadosQuery.refetch()}
            />
          </div>
        ) : !dadosQuery.isSuccess ? (
          <div className="mt-8 space-y-4" aria-busy="true" aria-label="Carregando o Painel">
            {[88, 140, 240].map((h) => (
              <div
                key={h}
                className="animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
                style={{ height: h }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Linha de contexto */}
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-y border-[var(--line)] py-4">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Dia no planejamento
                </span>
                <span className="font-cabinet rounded-lg bg-[var(--highlight)] px-3 py-0.5 text-[19px] font-semibold text-[var(--highlight-ink)]">
                  {ordinal(diasDesdeCadastro)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  Status
                </span>
                <span className="text-[15px] text-[var(--ink-soft)]">
                  {jornadaFinalizada
                    ? "Planejamento concluído"
                    : `Módulo ${moduloAtual} · ${etapaInfo.nome}`}
                </span>
                {/* ONE-11 (07/10/2026): era um "abrir" discreto e a Sil não achava
                o caminho de volta pro Planejamento. Virou botão com o verbo
                certo. A ação principal do Painel continua sendo registrar
                entrada e saída (COPY-04); este é o caminho secundário. */}
                <LinkInterno href="/planejamento" className={BTN_MIUDO}>
                  {jornadaFinalizada ? "Rever o Planejamento" : "Continuar o Planejamento"}
                  <span aria-hidden="true">→</span>
                </LinkInterno>
              </div>
            </div>

            {/* Quanto sobrou este mês: a resposta real de "quanto sobra", na primeira tela.
            Desde 03/09/2026 (COPY-04) o número é real em TODO plano: o cadeado
            saiu daqui porque o registro de entrada e saída deixou de ser pago.
            O que continua no Premium é a tela /financeiro, e só quem a tem é
            que ganha o cartão clicável. */}
            <div className="mt-6">
              <CartaoFinanceiro href={financeiroLiberado ? "/financeiro" : undefined} padding="p-6">
                <div className="flex items-start justify-between gap-3">
                  <TituloCartao className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Quanto sobrou · mês
                  </TituloCartao>
                  {!financeiroLiberado && <SeloControle />}
                </div>
                <p
                  className={`font-cabinet mt-1 text-[40px] leading-none ${
                    lucroMes < 0 ? "text-[var(--danger)]" : "text-[var(--ink)]"
                  }`}
                >
                  {fmtBRL(lucroMes)}
                </p>
                <p className="mt-2 text-[13px] text-[var(--muted)]">
                  {receitaMes > 0
                    ? `${Math.max(0, Math.round((lucroMes / receitaMes) * 100))}% de tudo que entrou`
                    : "registre entradas e saídas pra ver"}
                  {financeiroLiberado ? (
                    <>
                      {" "}
                      · <span className="text-[var(--ink-soft)]">Financeiro</span>
                    </>
                  ) : (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-[var(--ink-soft)]">
                        no Premium, o histórico fica completo e dá pra corrigir lançamento
                      </span>
                    </>
                  )}
                </p>
              </CartaoFinanceiro>
            </div>

            {/* Bento de dados */}
            <div className="mt-6 grid grid-cols-12 gap-4">
              <div className={SPAN_CLASS[4]}>
                <CartaoFinanceiro href={financeiroLiberado ? "/financeiro" : undefined}>
                  <TituloCartao className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Receita · mês
                  </TituloCartao>
                  <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
                    {fmtBRL(receitaMes)}
                  </p>
                  {metaCelebracao > 0 && (
                    <div className="relative mx-0.5 mt-4 h-2 rounded-md border border-[var(--line)] bg-[var(--bg)]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-[var(--secondary)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
                        style={{
                          width: `${Math.min(100, (receitaMes / metaCelebracao) * 100)}%`,
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
                    {metaBoa > 0
                      ? `${Math.min(100, Math.round((receitaMes / metaBoa) * 100))}% da Meta do mês (${fmtBRL(metaBoa)})`
                      : receitaMes > 0
                        ? "entradas esse mês"
                        : "ainda sem entradas"}
                    {financeiroLiberado && (
                      <>
                        {" "}
                        · <span className="text-[var(--ink-soft)]">Financeiro</span>
                      </>
                    )}
                  </p>
                </CartaoFinanceiro>
              </div>

              <div className={SPAN_CLASS[4]}>
                <CartaoFinanceiro href={financeiroLiberado ? "/financeiro" : undefined}>
                  <TituloCartao className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Pedidos · mês
                  </TituloCartao>
                  <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
                    {pedidosMes}
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--muted)]">
                    {pedidosMes > 0 ? "vendas registradas" : "nenhuma ainda"}
                    {financeiroLiberado && (
                      <>
                        {" "}
                        · <span className="text-[var(--ink-soft)]">ver entradas</span>
                      </>
                    )}
                  </p>
                </CartaoFinanceiro>
              </div>

              <div className={SPAN_CLASS[4]}>
                <CartaoFinanceiro href={destino("/clientes", clientesLiberado)}>
                  <div className="flex items-start justify-between gap-3">
                    <TituloCartao className="text-[10px] font-accent font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                      Clientes
                    </TituloCartao>
                    {!clientesLiberado && <SeloControle />}
                  </div>
                  <p className="font-cabinet mt-1 text-[32px] leading-none text-[var(--ink)]">
                    {clientesCount}
                  </p>
                  {/* Trancado, o zero não é falta de cadastro: é a trava do plano.
                  Então a linha diz o ganho, não um vazio que ela não causou. */}
                  <p className="mt-2 text-[13px] text-[var(--muted)]">
                    {!clientesLiberado ? (
                      "no Premium cada cliente fica com o status do pedido"
                    ) : (
                      <>
                        {clientesCount > 0
                          ? `${clientesEntregues} entregues · ${clientesEmEspera} em espera`
                          : "nenhuma cadastrada ainda"}{" "}
                        · <span className="text-[var(--ink-soft)]">Clientes</span>
                      </>
                    )}
                  </p>
                </CartaoFinanceiro>
              </div>

              {/* Registro mínimo de entrada e saída (COPY-04): é o que alimenta os
              três cartões acima pra quem não tem a tela /financeiro. Quem tem o
              Premium não vê este cartão — os cartões acima já levam pro
              Financeiro, que faz isso e muito mais. */}
              {!financeiroLiberado && userId && (
                <div className={SPAN_CLASS[12]}>
                  <RegistroDoMes
                    userId={userId}
                    lancamentos={dados?.lancamentos ?? []}
                    onMudou={() => qc.invalidateQueries({ queryKey: ["painel-dados", userId] })}
                  />
                </div>
              )}

              {/* Tarefas de hoje */}
              <div className={SPAN_CLASS[6]}>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white">
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
                    /* `semBorda`: já estamos dentro de um cartão, caixa tracejada
                   aqui viraria caixa dentro de caixa. A saída fica no link
                   "Abrir no Planner" logo abaixo, que vale pros dois estados. */
                    <div className="mt-4">
                      <Vazio
                        semBorda
                        titulo="Nenhuma tarefa com prazo nos próximos 7 dias."
                        texto="A próxima nasce no Planner."
                      />
                    </div>
                  ) : (
                    <div className="mt-3">
                      {gruposTarefas.atrasadas.length > 0 && (
                        <GrupoTarefasPainel
                          titulo="Passou do prazo"
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
                    <LinkInterno
                      href={quadroPendentesLink}
                      className="inline-flex min-h-6 items-center text-[var(--secondary-text)] hover:underline"
                    >
                      Abrir no Planner →
                    </LinkInterno>
                  </p>
                </div>
              </div>

              {/* Semana de trabalho */}
              <div className={SPAN_CLASS[6]}>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white">
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
                      <Vazio
                        semBorda
                        titulo="Nenhuma tarefa concluída nesta semana ainda."
                        texto="O gráfico aparece assim que a primeira fechar."
                        acao={
                          <LinkInterno
                            href={quadroPendentesLink}
                            className="inline-flex min-h-6 items-center gap-1 text-[13px] text-[var(--secondary-text)] no-underline hover:underline"
                          >
                            Abrir o Planner <span aria-hidden="true">→</span>
                          </LinkInterno>
                        }
                      />
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
                            <span className="text-[13px] font-semibold text-[var(--ink)]">
                              {d.tarefas > 0 ? d.tarefas : d.isFuturo ? "" : "0"}
                            </span>
                            <span
                              className="w-full max-w-[72px] rounded-t-md"
                              style={{
                                height: `${alturaPx}px`,
                                background: d.tarefas === 0 ? "var(--line)" : "var(--accent)",
                                border: d.isHoje ? "2px solid var(--ink)" : undefined,
                                borderBottom: d.isHoje ? "0" : undefined,
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
              </div>

              {/* Agenda: link pro calendário mensal (Planner + Google, quando conectado) */}
              <div className={SPAN_CLASS[12]}>
                <LinkInterno
                  href={destino("/calendario", calendarioLiberado)}
                  className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-white px-5 py-4 text-[14px] text-[var(--ink-soft)] no-underline transition-colors hover:border-[var(--secondary)]"
                >
                  <span className="shrink-0 rounded-md border border-[var(--line)] px-2 py-0.5 text-[10px] font-accent font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                    Calendário
                  </span>
                  <span>
                    {calendarioLiberado
                      ? "Veja o mês inteiro: tarefas do Planner e, se conectar, seus compromissos do Google."
                      : "no Premium, o mês inteiro aparece num só calendário: tarefas do Planner e, se conectar, os compromissos do Google."}
                  </span>
                  {calendarioLiberado ? (
                    <span className="ml-auto shrink-0 text-[var(--secondary-text)]">Abrir →</span>
                  ) : (
                    <span className="ml-auto">
                      <SeloControle />
                    </span>
                  )}
                </LinkInterno>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Registro aberto pelo botão da manchete. Mesmo componente do cartão
          "Entrou e saiu este mês" e mesma invalidação: o que for salvo aqui
          recalcula os três cartões de dinheiro na mesma hora. */}
      {registroAberto && userId && (
        <ModalLancamento
          userId={userId}
          tipoInicial="entrada"
          dataPadrao={hojeISO()}
          prefill={null}
          lancamentoEdit={null}
          historico={dados?.lancamentos ?? []}
          onClose={() => setRegistroAberto(false)}
          onSaved={() => {
            setRegistroAberto(false);
            qc.invalidateQueries({ queryKey: ["painel-dados", userId] });
          }}
        />
      )}
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
        <LinkInterno
          href={link}
          title={linkTitulo}
          className={`mb-1 inline-flex min-h-6 items-center text-[10px] font-accent font-bold uppercase tracking-[0.14em] no-underline hover:underline ${
            corTitulo ?? "text-[var(--muted)] hover:text-[var(--ink-soft)]"
          }`}
        >
          {titulo} →
        </LinkInterno>
      ) : (
        <p
          className={`mb-1 text-[10px] font-accent font-bold uppercase tracking-[0.14em] ${
            corTitulo ?? "text-[var(--muted)]"
          }`}
        >
          {titulo}
        </p>
      )}
      <ul>
        {visiveis.map((t, i) => (
          <li key={t.id} className="border-b border-[var(--line)] last:border-b-0">
            <LinkInterno
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
            </LinkInterno>
          </li>
        ))}
      </ul>
      {restantes > 0 && link && (
        <LinkInterno
          href={link}
          className="mt-2 inline-flex min-h-6 items-center gap-1 text-[13px] text-[var(--secondary-text)] no-underline hover:underline"
        >
          {rotuloMais ? rotuloMais(restantes) : `mais ${restantes} no Planner`}{" "}
          <span aria-hidden="true">→</span>
        </LinkInterno>
      )}
    </div>
  );
}
