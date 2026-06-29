import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { PainelNav } from "@/components/painel/PainelNav";
import { GuiaInsight } from "@/components/painel/GuiaInsight";
import {
  Flame,
  Star,
  Target,
  CheckCircle2,
  Timer,
  Sparkles,
  ListTodo,
  Clock,
  AlertTriangle,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/progresso")({
  head: () => ({
    meta: [
      { title: "Seu Progresso · Pólia" },
      { name: "description", content: "O quanto você já caminhou — em números." },
    ],
  }),
  component: ProgressoPage,
});

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreak(dates: Set<string>): number {
  let streak = 0;
  let skipped = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (true) {
    const key = localDateKey(cursor);
    if (dates.has(key)) {
      streak += 1;
      skipped = 0;
    } else if (streak === 0 && skipped === 0) {
      skipped = 1;
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const STATUS_TRAB = [
  { id: "ideias", label: "Ideias", cor: "#1A1A2E" },
  { id: "planejado", label: "Planejado", cor: "#6B50CC" },
  { id: "hoje", label: "Hoje", cor: "#C96B3E" },
  { id: "em_progresso", label: "Em progresso", cor: "#1A7FAD" },
  { id: "pausado", label: "Pausado", cor: "#B8862E" },
  { id: "concluido", label: "Concluído", cor: "#2D6A4F" },
];
const COL_IDS6 = STATUS_TRAB.map((s) => s.id);

interface CardT {
  status: string;
  created_at: string;
  updated_at: string;
  prazo: string | null;
  assigned_to: string | null;
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeTrabalho(cards: CardT[], membros: { id: string; nome: string }[]) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const total = cards.length;
  const concl = cards.filter((c) => c.status === "concluido");
  const concluidos = concl.length;
  const emAndamento = cards.filter(
    (c) => c.status === "hoje" || c.status === "em_progresso",
  ).length;
  const atrasados = cards.filter(
    (c) => c.status !== "concluido" && c.prazo && new Date(c.prazo + "T00:00:00") < hoje,
  ).length;
  const taxa = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  // Throughput — últimas 8 semanas (cards concluídos por semana)
  const thisMon = mondayOf(hoje);
  const throughput: { label: string; qtd: number }[] = [];
  const semIndex = new Map<number, number>();
  for (let i = 7; i >= 0; i--) {
    const m = new Date(thisMon);
    m.setDate(m.getDate() - i * 7);
    semIndex.set(m.getTime(), throughput.length);
    throughput.push({ label: ddmm(m), qtd: 0 });
  }
  for (const c of concl) {
    const wk = mondayOf(new Date(c.updated_at)).getTime();
    const idx = semIndex.get(wk);
    if (idx !== undefined) throughput[idx].qtd++;
  }

  // Distribuição por status
  const distro = STATUS_TRAB.map((s) => ({
    ...s,
    qtd: cards.filter((c) => (COL_IDS6.includes(c.status) ? c.status : "ideias") === s.id).length,
  }));

  // Tempo até entregar (cycle time, em dias) dos concluídos
  const dias = concl.map((c) =>
    Math.max(
      0,
      Math.round(
        (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 86_400_000,
      ),
    ),
  );
  const cycle = dias.length
    ? {
        media: Math.round(dias.reduce((a, b) => a + b, 0) / dias.length),
        min: Math.min(...dias),
        max: Math.max(...dias),
      }
    : null;

  // Carga das próximas 4 semanas (cards abertos com prazo)
  const prox: { label: string; qtd: number; alerta: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    const ini = new Date(thisMon);
    ini.setDate(ini.getDate() + i * 7);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 7);
    const qtd = cards.filter(
      (c) =>
        c.status !== "concluido" &&
        c.prazo &&
        new Date(c.prazo + "T00:00:00") >= ini &&
        new Date(c.prazo + "T00:00:00") < fim,
    ).length;
    prox.push({
      label: i === 0 ? "esta semana" : i === 1 ? "próxima" : `em ${i} sem`,
      qtd,
      alerta: qtd >= 5,
    });
  }

  // Por pessoa (carga aberta + concluídos)
  const nomeDe = (id: string | null) => membros.find((m) => m.id === id)?.nome ?? null;
  const grupos = new Map<string, { nome: string; aberto: number; concluidos: number }>();
  for (const c of cards) {
    const k = c.assigned_to ?? "__none__";
    if (!grupos.has(k))
      grupos.set(k, { nome: nomeDe(c.assigned_to) ?? "Sem responsável", aberto: 0, concluidos: 0 });
    const g = grupos.get(k)!;
    if (c.status === "concluido") g.concluidos++;
    else g.aberto++;
  }
  const porPessoa = [...grupos.values()].sort(
    (a, b) => b.aberto + b.concluidos - (a.aberto + a.concluidos),
  );

  return {
    total,
    concluidos,
    emAndamento,
    atrasados,
    taxa,
    throughput,
    distro,
    cycle,
    prox,
    porPessoa,
  };
}

function ProgressoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;

  const dados = useQuery({
    queryKey: ["progresso", userId],
    enabled: !!userId,
    queryFn: async () => {
      const seteDias = new Date();
      seteDias.setDate(seteDias.getDate() - 6);
      seteDias.setHours(0, 0, 0, 0);
      const seteDiasKey = localDateKey(seteDias);
      const seteDiasISO = seteDias.toISOString();

      const [
        { data: profile },
        { data: tarefas },
        { data: metas },
        { data: habitos },
        { data: habitoLogs },
        { data: foco },
        { data: checkins },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("tarefas").select("status").eq("user_id", userId!),
        supabase.from("metas").select("status, progresso").eq("user_id", userId!),
        supabase.from("habitos").select("id").eq("user_id", userId!).eq("ativo", true),
        supabase.from("habito_logs").select("data").eq("user_id", userId!).gte("data", seteDiasKey),
        supabase
          .from("foco_sessoes")
          .select("duracao_min, created_at")
          .eq("user_id", userId!)
          .eq("tipo", "foco")
          .gte("created_at", seteDiasISO),
        supabase.from("checkins").select("data").eq("user_id", userId!).gte("data", seteDiasKey),
      ]);

      // Etapas concluídas (star_N_completed_at)
      let etapasConcluidas = 0;
      if (profile) {
        for (let i = 1; i <= 11; i++) {
          if ((profile as Record<string, unknown>)[`star_${i}_completed_at`]) etapasConcluidas++;
        }
      }

      const tarefasProntas = (tarefas ?? []).filter((t) => t.status === "floresceu").length;
      const metasConcluidas = (metas ?? []).filter((m) => m.status === "concluida").length;
      const metasAtivas = (metas ?? []).filter((m) => m.status === "ativa");
      const progressoMedio =
        metasAtivas.length > 0
          ? Math.round(
              metasAtivas.reduce((acc, m) => acc + (m.progresso ?? 0), 0) / metasAtivas.length,
            )
          : 0;

      const focoSemanaMin = (foco ?? []).reduce((acc, s) => acc + (s.duracao_min ?? 0), 0);

      // Série de 7 dias: minutos de foco por dia
      const porDia = new Map<string, number>();
      for (const s of foco ?? []) {
        const k = localDateKey(new Date(s.created_at));
        porDia.set(k, (porDia.get(k) ?? 0) + (s.duracao_min ?? 0));
      }
      const serie: { dia: string; min: number; hoje: boolean }[] = [];
      const hojeKey = localDateKey(new Date());
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = localDateKey(d);
        serie.push({
          dia: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()],
          min: porDia.get(k) ?? 0,
          hoje: k === hojeKey,
        });
      }

      // Streak por check-in + tarefa concluída já vive no header; aqui mostramos o do profile.
      const checkinDias = new Set((checkins ?? []).map((c) => c.data));

      return {
        streak: (profile?.streak as number) ?? 0,
        etapasConcluidas,
        tarefasProntas,
        metasConcluidas,
        progressoMedio,
        focoSemanaMin,
        habitosAtivos: (habitos ?? []).length,
        habitoMarcacoesSemana: (habitoLogs ?? []).length,
        checkinsSemana: checkinDias.size,
        serie,
      };
    },
  });

  const trabalhoQuery = useQuery({
    queryKey: ["progresso-trabalho", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [{ data: cards }, { data: membros }] = await Promise.all([
        supabase
          .from("tarefas")
          .select("status, created_at, updated_at, prazo, assigned_to")
          .eq("user_id", userId!)
          .not("quadro_id", "is", null),
        supabase.from("equipe_membros").select("id, nome").eq("user_id", userId!),
      ]);
      return computeTrabalho((cards ?? []) as CardT[], membros ?? []);
    },
  });

  const d = dados.data;
  const t = trabalhoQuery.data;
  const resumoProgresso =
    d && t
      ? `Cards: ${t.total} no total, ${t.concluidos} concluídos (${t.taxa}%), ${t.atrasados} atrasados. ` +
        `Tempo médio até entregar: ${t.cycle ? t.cycle.media + " dias" : "sem dados"}. ` +
        `Foco na semana: ${d.focoSemanaMin} min. Streak: ${d.streak} dias. ` +
        `Metas concluídas: ${d.metasConcluidas}. Hábitos ativos: ${d.habitosAtivos}.`
      : "";

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      <PainelNav navActive="/progresso" />

      <main className="mx-auto max-w-[900px] px-6 py-10 sm:px-8 sm:py-12">
        <div className="mb-8">
          <h1 className="mb-2 font-serif text-[36px] leading-tight text-[#1A1A2E] sm:text-[40px]">
            Seu Progresso
          </h1>
          <p className="caveat-decorativo text-[#C96B3E]">o quanto você já caminhou.</p>
        </div>

        {dados.isLoading || !d ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-white/60" />
            ))}
          </div>
        ) : (
          <>
            <GuiaInsight contexto="progresso" resumo={resumoProgresso} className="mb-6" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric
                icon={<Flame size={18} />}
                valor={`${d.streak}`}
                unidade={d.streak === 1 ? "dia seguido" : "dias seguidos"}
                cor="#C96B3E"
              />
              <Metric
                icon={<Star size={18} />}
                valor={`${d.etapasConcluidas}/11`}
                unidade="etapas concluídas"
                cor="#B8862E"
              />
              <Metric
                icon={<CheckCircle2 size={18} />}
                valor={`${d.tarefasProntas}`}
                unidade="tarefas prontas"
                cor="#2D6A4F"
              />
              <Metric
                icon={<Target size={18} />}
                valor={`${d.metasConcluidas}`}
                unidade="metas concluídas"
                cor="#6B50CC"
              />
              <Metric
                icon={<Timer size={18} />}
                valor={`${d.focoSemanaMin}`}
                unidade="min de foco na semana"
                cor="#1A7FAD"
              />
              <Metric
                icon={<Sparkles size={18} />}
                valor={`${d.habitosAtivos}`}
                unidade={d.habitosAtivos === 1 ? "hábito ativo" : "hábitos ativos"}
                cor="#C96B3E"
              />
            </div>

            {/* Gráfico — foco nos últimos 7 dias */}
            <section className="mt-8 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 sm:p-6">
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="font-serif text-[20px] text-[#1A1A2E]">Foco nos últimos 7 dias</h2>
                <span className="font-sans text-[13px] text-[#1A1A2E] opacity-45">
                  {d.focoSemanaMin} min no total
                </span>
              </div>
              <p className="mb-5 caveat-decorativo text-[#C96B3E]">
                {d.focoSemanaMin === 0
                  ? "comece um foco hoje e veja a barra crescer."
                  : "cada barra é um dia que você se dedicou."}
              </p>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.serie} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <XAxis
                      dataKey="dia"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "rgba(26,26,46,0.5)" }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(201,107,62,0.06)" }}
                      formatter={(v: number) => [`${v} min`, "foco"]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgba(26,26,46,0.1)",
                        fontFamily: "Inter, sans-serif",
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="min" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {d.serie.map((entry, i) => (
                        <Cell key={i} fill={entry.hoje ? "#C96B3E" : "rgba(201,107,62,0.35)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Resumo da semana */}
            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ResumoLinha
                titulo="Constância no diário"
                valor={`${d.checkinsSemana}/7`}
                texto="dias com check-in nesta semana"
              />
              <ResumoLinha
                titulo="Hábitos marcados"
                valor={`${d.habitoMarcacoesSemana}`}
                texto="marcações nos últimos 7 dias"
              />
              <ResumoLinha
                titulo="Progresso médio das metas"
                valor={`${d.progressoMedio}%`}
                texto="entre as metas ainda ativas"
              />
              <ResumoLinha
                titulo="Etapas da jornada"
                valor={`${d.etapasConcluidas}/11`}
                texto="estrelas acesas no seu mapa"
              />
            </section>

            {/* SEÇÃO — SEU TRABALHO (cards dos quadros) */}
            <div className="mb-5 mt-12">
              <h2 className="font-serif text-[28px] leading-tight text-[#1A1A2E]">Seu trabalho</h2>
              <p className="caveat-decorativo text-[#C96B3E]">o que você toca nos seus quadros.</p>
            </div>

            {trabalhoQuery.isLoading || !t ? (
              <div className="h-40 animate-pulse rounded-2xl bg-white/60" />
            ) : t.total === 0 ? (
              <div className="rounded-2xl border border-dashed border-[rgba(26,26,46,0.12)] bg-white/50 px-6 py-10 text-center">
                <p className="font-sans text-[14px] leading-relaxed text-[#1A1A2E] opacity-55">
                  Crie cards nos seus{" "}
                  <a href="/planner" className="text-[#C96B3E] hover:underline">
                    Quadros
                  </a>{" "}
                  pra ver seus números de trabalho aqui.
                </p>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  <Metric
                    icon={<ListTodo size={18} />}
                    valor={`${t.total}`}
                    unidade="cards no total"
                    cor="#1A1A2E"
                  />
                  <Metric
                    icon={<CheckCircle2 size={18} />}
                    valor={`${t.concluidos}`}
                    unidade="concluídos"
                    cor="#2D6A4F"
                  />
                  <Metric
                    icon={<Timer size={18} />}
                    valor={`${t.emAndamento}`}
                    unidade="em andamento"
                    cor="#1A7FAD"
                  />
                  <Metric
                    icon={<AlertTriangle size={18} />}
                    valor={`${t.atrasados}`}
                    unidade="atrasados"
                    cor="#C9407A"
                  />
                  <Metric
                    icon={<Sparkles size={18} />}
                    valor={`${t.taxa}%`}
                    unidade="taxa de conclusão"
                    cor="#C96B3E"
                  />
                </div>

                {/* Throughput */}
                <section className="mt-6 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 sm:p-6">
                  <h2 className="font-serif text-[20px] text-[#1A1A2E]">
                    Quanto você entrega por semana
                  </h2>
                  <p className="mb-5 caveat-decorativo text-[#C96B3E]">
                    cada barra é uma semana — a altura é quantos cards você terminou.
                  </p>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={t.throughput}
                        margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                      >
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "rgba(26,26,46,0.5)" }}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(45,106,79,0.06)" }}
                          formatter={(v: number) => [`${v} cards`, "entregues"]}
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid rgba(26,26,46,0.1)",
                            fontFamily: "Inter, sans-serif",
                            fontSize: 13,
                          }}
                        />
                        <Bar dataKey="qtd" radius={[6, 6, 0, 0]} maxBarSize={42} fill="#2D6A4F" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  {/* Distribuição por status */}
                  <section className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 sm:p-6">
                    <h2 className="mb-4 font-serif text-[20px] text-[#1A1A2E]">
                      Onde estão seus cards
                    </h2>
                    {t.distro.map((s) => (
                      <DistroBar
                        key={s.id}
                        label={s.label}
                        cor={s.cor}
                        qtd={s.qtd}
                        total={t.total}
                      />
                    ))}
                  </section>

                  {/* Tempo até entregar */}
                  <section className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 sm:p-6">
                    <h2 className="mb-1 font-serif text-[20px] text-[#1A1A2E]">
                      Tempo até entregar
                    </h2>
                    <p className="mb-5 caveat-decorativo text-[#C96B3E]">
                      da criação até o card ficar pronto.
                    </p>
                    {t.cycle ? (
                      <div className="flex items-end gap-6">
                        <div>
                          <p className="font-serif text-[40px] leading-none text-[#C96B3E]">
                            {t.cycle.media}
                          </p>
                          <p className="mt-1 font-sans text-[13px] text-[#1A1A2E] opacity-55">
                            {t.cycle.media === 1 ? "dia em média" : "dias em média"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 pb-1 font-sans text-[13px] text-[#1A1A2E] opacity-50">
                          <Clock size={14} /> mais rápido {t.cycle.min}d · mais longo {t.cycle.max}d
                        </div>
                      </div>
                    ) : (
                      <p className="font-sans text-[14px] text-[#1A1A2E] opacity-45">
                        ainda sem cards concluídos pra medir.
                      </p>
                    )}
                  </section>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  {/* Carga das próximas semanas */}
                  <section className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 sm:p-6">
                    <h2 className="mb-4 font-serif text-[20px] text-[#1A1A2E]">
                      Carga das próximas semanas
                    </h2>
                    <div className="space-y-2.5">
                      {t.prox.map((p) => (
                        <div key={p.label} className="flex items-center justify-between gap-3">
                          <span className="font-sans text-[14px] text-[#1A1A2E] capitalize">
                            {p.label}
                          </span>
                          <span
                            className="rounded-full px-2.5 py-1 font-sans text-[12px] font-medium"
                            style={
                              p.alerta
                                ? { background: "rgba(184,134,46,0.14)", color: "#B8862E" }
                                : { background: "rgba(26,26,46,0.05)", color: "#1A1A2E" }
                            }
                          >
                            {p.qtd} {p.qtd === 1 ? "card" : "cards"}
                            {p.alerta ? " · semana cheia" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Por pessoa */}
                  <section className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-5 sm:p-6">
                    <h2 className="mb-4 flex items-center gap-2 font-serif text-[20px] text-[#1A1A2E]">
                      <Users size={18} className="opacity-50" /> Por pessoa
                    </h2>
                    <div className="space-y-3">
                      {t.porPessoa.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <span className="truncate font-sans text-[14px] text-[#1A1A2E]">
                            {p.nome}
                          </span>
                          <span className="shrink-0 font-sans text-[13px] text-[#1A1A2E] opacity-55">
                            {p.aberto} em aberto · {p.concluidos} prontos
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function DistroBar({
  label,
  cor,
  qtd,
  total,
}: {
  label: string;
  cor: string;
  qtd: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((qtd / total) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-sans text-[13px] text-[#1A1A2E]">{label}</span>
        <span className="font-sans text-[12px] text-[#1A1A2E] opacity-45">{qtd}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(26,26,46,0.06)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  );
}

function Metric({
  icon,
  valor,
  unidade,
  cor,
}: {
  icon: ReactNode;
  valor: string;
  unidade: string;
  cor: string;
}) {
  return (
    <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-4">
      <span
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: `${cor}1A`, color: cor }}
      >
        {icon}
      </span>
      <p className="font-serif text-[30px] leading-none text-[#1A1A2E]">{valor}</p>
      <p className="mt-1.5 font-sans text-[12.5px] leading-snug text-[#1A1A2E] opacity-50">
        {unidade}
      </p>
    </div>
  );
}

function ResumoLinha({ titulo, valor, texto }: { titulo: string; valor: string; texto: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white px-5 py-4">
      <span className="font-serif text-[26px] leading-none text-[#C96B3E]">{valor}</span>
      <div className="min-w-0">
        <p className="font-sans text-[14px] font-medium text-[#1A1A2E]">{titulo}</p>
        <p className="font-sans text-[12.5px] text-[#1A1A2E] opacity-50">{texto}</p>
      </div>
    </div>
  );
}
