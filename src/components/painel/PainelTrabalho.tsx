import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { Sun, AlertTriangle, Users, CheckCircle2 } from "lucide-react";

interface CardT {
  status: string;
  prazo: string | null;
  assigned_to: string | null;
}

const COLUNAS = [
  { id: "ideias", label: "Ideias", cor: "#1A1A2E" },
  { id: "planejado", label: "Planejado", cor: "#6B50CC" },
  { id: "hoje", label: "Hoje", cor: "#C96B3E" },
  { id: "em_progresso", label: "Em progresso", cor: "#1A7FAD" },
  { id: "pausado", label: "Pausado", cor: "#B8862E" },
  { id: "concluido", label: "Concluído", cor: "#2D6A4F" },
];
const COL_IDS = COLUNAS.map((c) => c.id);

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function PainelTrabalho() {
  const { user } = useSupabaseSession();
  const userId = user?.id;

  const q = useQuery({
    queryKey: ["painel-trabalho", userId],
    enabled: !!userId,
    queryFn: async () => {
      const hojeKey = localDateKey(new Date());
      const [{ data: cards }, { data: checkin }, { data: metas }, { data: equipe }] =
        await Promise.all([
          supabase
            .from("tarefas")
            .select("status, prazo, assigned_to")
            .eq("user_id", userId!)
            .not("quadro_id", "is", null),
          supabase
            .from("checkins")
            .select("id")
            .eq("user_id", userId!)
            .eq("data", hojeKey)
            .maybeSingle(),
          supabase
            .from("metas")
            .select("prazo")
            .eq("user_id", userId!)
            .eq("status", "ativa")
            .not("prazo", "is", null),
          supabase
            .from("equipe_membros")
            .select("id, nome")
            .eq("user_id", userId!)
            .eq("status", "ativo"),
        ]);
      return {
        cards: (cards ?? []) as CardT[],
        temCheckin: !!checkin,
        metasPrazos: (metas ?? []).map((m) => m.prazo as string),
        equipe: (equipe ?? []) as { id: string; nome: string }[],
      };
    },
  });

  const dados = q.data;

  const calc = useMemo(() => {
    if (!dados) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const colDe = (s: string) => (COL_IDS.includes(s) ? s : "ideias");

    const kpis = COLUNAS.map((c) => ({
      ...c,
      qtd: dados.cards.filter((card) => colDe(card.status) === c.id).length,
    }));

    const atrasadosCards = dados.cards.filter(
      (c) => c.status !== "concluido" && c.prazo && new Date(c.prazo + "T00:00:00") < hoje,
    ).length;
    const atrasadasMetas = dados.metasPrazos.filter(
      (p) => p && new Date(p + "T00:00:00") < hoje,
    ).length;
    const semProgresso =
      dados.cards.filter((c) => c.status === "hoje" || c.status === "em_progresso").length === 0 &&
      dados.cards.length > 0;

    // Delegadas por pessoa (cards abertos atribuídos)
    const nome = (id: string) => dados.equipe.find((m) => m.id === id)?.nome ?? "alguém";
    const porPessoa = new Map<string, number>();
    for (const c of dados.cards) {
      if (c.assigned_to && c.status !== "concluido") {
        porPessoa.set(c.assigned_to, (porPessoa.get(c.assigned_to) ?? 0) + 1);
      }
    }
    const delegadas = [...porPessoa.entries()]
      .map(([id, qtd]) => ({ nome: nome(id), qtd }))
      .sort((a, b) => b.qtd - a.qtd);
    const totalDelegadas = delegadas.reduce((a, d) => a + d.qtd, 0);

    // Calendário do mês — dias com prazos (cards abertos + metas)
    const prazosPorDia = new Map<string, number>();
    const add = (p: string | null) => {
      if (!p) return;
      prazosPorDia.set(p, (prazosPorDia.get(p) ?? 0) + 1);
    };
    dados.cards.forEach((c) => {
      if (c.status !== "concluido") add(c.prazo);
    });
    dados.metasPrazos.forEach((p) => add(p));

    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const offset = (new Date(ano, mes, 1).getDay() + 6) % 7;
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const celulas: ({ dia: number; count: number; ehHoje: boolean } | null)[] = [];
    for (let i = 0; i < offset; i++) celulas.push(null);
    for (let d = 1; d <= diasNoMes; d++) {
      const key = localDateKey(new Date(ano, mes, d));
      celulas.push({ dia: d, count: prazosPorDia.get(key) ?? 0, ehHoje: d === hoje.getDate() });
    }

    return {
      kpis,
      atrasados: atrasadosCards + atrasadasMetas,
      semProgresso,
      delegadas,
      totalDelegadas,
      celulas,
      nomeMes: MESES[mes],
      temCards: dados.cards.length > 0,
    };
  }, [dados]);

  if (!dados || !calc) return null;

  return (
    <section className="bg-polia-creme px-6 pb-4 md:px-12">
      <div className="mx-auto max-w-[1280px] space-y-5">
        {/* Check-in pendente */}
        {!dados.temCheckin && (
          <a
            href="/diario"
            className="flex items-center gap-4 rounded-2xl border border-[rgba(201,107,62,0.25)] bg-[rgba(201,107,62,0.06)] p-4 transition-colors hover:bg-[rgba(201,107,62,0.1)]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-polia-terracota text-polia-creme">
              <Sun size={20} />
            </span>
            <div className="flex-1">
              <p className="font-sans text-[15px] font-semibold text-polia-noite">
                Como você está hoje?
              </p>
              <p className="font-sans text-[13px] text-polia-noite opacity-55">
                faça seu check-in do dia — leva um minuto.
              </p>
            </div>
            <span className="hidden font-sans text-[14px] font-medium text-polia-terracota sm:block">
              fazer agora →
            </span>
          </a>
        )}

        {/* 6 KPIs por status + alertas + delegadas + calendário */}
        {calc.temCards ? (
          <>
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
              {calc.kpis.map((k) => (
                <div
                  key={k.id}
                  className="rounded-xl border border-[rgba(26,26,46,0.06)] bg-white p-3 text-center"
                >
                  <p className="font-serif text-[26px] leading-none" style={{ color: k.cor }}>
                    {k.qtd}
                  </p>
                  <p className="mt-1 font-sans text-[11px] leading-tight text-polia-noite opacity-55">
                    {k.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              {/* Coluna esquerda: alertas + delegadas */}
              <div className="space-y-4">
                {(calc.atrasados > 0 || calc.semProgresso) && (
                  <div className="rounded-2xl border border-[rgba(184,134,46,0.25)] bg-[rgba(184,134,46,0.06)] p-4">
                    <p className="mb-2 flex items-center gap-2 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-[#B8862E]">
                      <AlertTriangle size={13} /> Atenção
                    </p>
                    <ul className="space-y-1 font-sans text-[14px] text-polia-noite">
                      {calc.atrasados > 0 && (
                        <li>
                          {calc.atrasados} {calc.atrasados === 1 ? "item passou" : "itens passaram"}{" "}
                          do prazo —{" "}
                          <a href="/planner" className="text-[#C96B3E] hover:underline">
                            ver nos quadros
                          </a>
                        </li>
                      )}
                      {calc.semProgresso && (
                        <li>Nada em progresso agora. Que tal puxar um card pra “Hoje”?</li>
                      )}
                    </ul>
                  </div>
                )}

                {calc.totalDelegadas > 0 && (
                  <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-4">
                    <p className="mb-3 flex items-center gap-2 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-polia-noite opacity-50">
                      <Users size={13} /> Delegadas ao time
                    </p>
                    <div className="space-y-2">
                      {calc.delegadas.map((d) => (
                        <div key={d.nome} className="flex items-center justify-between">
                          <span className="font-sans text-[14px] text-polia-noite">{d.nome}</span>
                          <span className="font-sans text-[13px] text-polia-noite opacity-55">
                            {d.qtd} {d.qtd === 1 ? "card" : "cards"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {calc.atrasados === 0 && !calc.semProgresso && calc.totalDelegadas === 0 && (
                  <div className="flex items-center gap-2 rounded-2xl border border-[rgba(45,106,79,0.2)] bg-[rgba(45,106,79,0.05)] p-4 font-sans text-[14px] text-[#2D6A4F]">
                    <CheckCircle2 size={16} /> Tudo no rumo — nada atrasado.
                  </div>
                )}
              </div>

              {/* Coluna direita: calendário do mês */}
              <div className="rounded-2xl border border-[rgba(26,26,46,0.06)] bg-white p-4">
                <p className="mb-3 font-accent text-[10px] font-bold uppercase tracking-[1.5px] text-polia-noite opacity-50">
                  Prazos de {calc.nomeMes}
                </p>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                    <span key={i} className="font-sans text-[10px] text-polia-noite opacity-30">
                      {d}
                    </span>
                  ))}
                  {calc.celulas.map((cel, i) =>
                    cel === null ? (
                      <span key={i} />
                    ) : (
                      <span
                        key={i}
                        title={cel.count > 0 ? `${cel.count} com prazo` : undefined}
                        className="relative flex h-7 items-center justify-center rounded-md font-sans text-[12px]"
                        style={
                          cel.ehHoje
                            ? {
                                background: "rgba(201,107,62,0.12)",
                                color: "#C96B3E",
                                fontWeight: 600,
                              }
                            : { color: "rgba(26,26,46,0.7)" }
                        }
                      >
                        {cel.dia}
                        {cel.count > 0 && (
                          <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#C96B3E]" />
                        )}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
