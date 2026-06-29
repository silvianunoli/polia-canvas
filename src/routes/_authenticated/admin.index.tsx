import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Admin · Pólia" }],
  }),
  component: AdminHome,
});

function AdminHome() {
  const [stats, setStats] = useState({
    ecua_m: 0,
    ativacao_d7: 0,
    mediana_etapa: 1,
    wau2: 0,
    retencao_d30: 0,
    total_cadastros: 0,
    lista_espera_total: 0,
  });
  const [alertasVermelhos, setAlertasVermelhos] = useState<any[]>([]);
  const [saude, setSaude] = useState({ eventos24h: 0, erros24h: 0, latencia: 0 });
  const [censo, setCenso] = useState<{ label: string; valor: number }[]>([]);

  useEffect(() => {
    (async () => {
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const dias14 = new Date(Date.now() - 14 * 86400000).toISOString();
      const dias10 = new Date(Date.now() - 10 * 86400000).toISOString();
      const dias7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const dias30 = new Date(Date.now() - 30 * 86400000).toISOString();

      const [
        { count: totalCadastros },
        { count: listaEspera },
        { data: profilesAtivos },
        { data: ativadasD7 },
        { data: profilesAll },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("lista_espera").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("etapa_atual,updated_at").gte("updated_at", dias14),
        supabase
          .from("profiles")
          .select("id,created_at,star_1_completed_at")
          .gte("created_at", dias30),
        supabase.from("profiles").select("etapa_atual").gt("etapa_atual", 0),
      ]);

      const wau2 = profilesAtivos?.length ?? 0;
      const etapas = (profilesAll ?? [])
        .map((p: any) => p.etapa_atual)
        .sort((a: number, b: number) => a - b);
      const medianaEtapa = etapas.length ? etapas[Math.floor(etapas.length / 2)] : 1;

      const ativacaoNum = (ativadasD7 ?? []).filter((p: any) => {
        if (!p.star_1_completed_at) return false;
        return (
          new Date(p.star_1_completed_at).getTime() - new Date(p.created_at).getTime() <=
          7 * 86400000
        );
      }).length;
      const ativacaoD7 = ativadasD7?.length
        ? Math.round((ativacaoNum / ativadasD7.length) * 100)
        : 0;

      // ECUA-M: total etapas completadas no mes / ativas
      const ecuaM =
        wau2 > 0
          ? profilesAtivos!.reduce((s: number, p: any) => s + (p.etapa_atual ?? 0), 0) / wau2
          : 0;

      const { data: paradas } = await supabase
        .from("profiles")
        .select("id,full_name,etapa_atual,updated_at")
        .lt("updated_at", dias10)
        .gt("etapa_atual", 0)
        .is("jornada_completed_at", null)
        .order("updated_at", { ascending: true })
        .limit(5);

      setAlertasVermelhos(
        (paradas ?? []).map((p: any) => ({
          id: p.id,
          nome: p.full_name ?? "Sem nome",
          etapa_atual: p.etapa_atual,
          dias_parada: Math.floor((Date.now() - new Date(p.updated_at).getTime()) / 86400000),
          ultima_atividade: new Date(p.updated_at).toLocaleDateString("pt-BR"),
        })),
      );

      setStats({
        ecua_m: ecuaM,
        ativacao_d7: ativacaoD7,
        mediana_etapa: medianaEtapa,
        wau2,
        retencao_d30: 0,
        total_cadastros: totalCadastros ?? 0,
        lista_espera_total: listaEspera ?? 0,
      });

      // Saúde do sistema (24h) + censo de dados — só o que é real (tabelas que o admin lê).
      const dias1 = new Date(Date.now() - 86400000).toISOString();
      const [
        { data: logs24 },
        { count: cTickets },
        { count: cFeedback },
        { count: cContatos },
        { count: cPosts },
        { count: cLogs },
      ] = await Promise.all([
        supabase
          .from("edge_function_logs")
          .select("latency_ms, error_message")
          .gte("created_at", dias1),
        supabase.from("tickets").select("*", { count: "exact", head: true }),
        supabase.from("feedback_responses").select("*", { count: "exact", head: true }),
        supabase.from("contatos").select("*", { count: "exact", head: true }),
        supabase.from("blog_posts").select("*", { count: "exact", head: true }),
        supabase.from("edge_function_logs").select("*", { count: "exact", head: true }),
      ]);
      const eventos = (logs24 ?? []) as {
        latency_ms: number | null;
        error_message: string | null;
      }[];
      const comLat = eventos.filter((l) => typeof l.latency_ms === "number");
      setSaude({
        eventos24h: eventos.length,
        erros24h: eventos.filter((l) => l.error_message).length,
        latencia: comLat.length
          ? Math.round(comLat.reduce((s, l) => s + (l.latency_ms ?? 0), 0) / comLat.length)
          : 0,
      });
      setCenso([
        { label: "Usuárias", valor: totalCadastros ?? 0 },
        { label: "Chamados", valor: cTickets ?? 0 },
        { label: "Feedbacks", valor: cFeedback ?? 0 },
        { label: "Contatos", valor: cContatos ?? 0 },
        { label: "Posts", valor: cPosts ?? 0 },
        { label: "Eventos (log)", valor: cLogs ?? 0 },
      ]);
    })();
  }, []);

  const metricas: {
    label: string;
    sigla?: string;
    tooltip?: string;
    valor: string | number;
    ok: boolean;
    desc: string;
  }[] = [
    {
      label: "Ativação",
      sigla: "D7",
      tooltip: "em 7 dias depois do cadastro",
      valor: `${stats.ativacao_d7}%`,
      ok: stats.ativacao_d7 >= 40,
      desc: "completaram E1 em 7 dias",
    },
    {
      label: "Mediana de Etapa",
      tooltip: "etapa onde metade das ativas está",
      valor: `E${stats.mediana_etapa}`,
      ok: true,
      desc: "onde metade das ativas está",
    },
    {
      label: "Ativas",
      sigla: "WAU-2",
      tooltip: "ativas nas últimas 2 semanas com ação real",
      valor: stats.wau2,
      ok: true,
      desc: "últ. 14 dias com ação real",
    },
    {
      label: "Retenção",
      sigla: "D30",
      tooltip: "trinta dias depois do cadastro",
      valor: `${stats.retencao_d30}%`,
      ok: stats.retencao_d30 >= 35,
      desc: "coorte do mês anterior",
    },
    { label: "Total cadastros", valor: stats.total_cadastros, ok: true, desc: "desde o início" },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="bg-[#1A1A2E] rounded-2xl p-8 mb-6">
        <p className="font-mono text-[#C96B3E] text-[10px] tracking-[2px] uppercase mb-2 flex items-center gap-1.5">
          <span>NORTH STAR · ECUA-M</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="O que é ECUA-M"
                className="inline-flex items-center justify-center min-h-[24px] min-w-[24px] text-[#C96B3E]/70 hover:text-[#C96B3E]"
              >
                <HelpCircle size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>etapas completadas por usuária ativa este mês</TooltipContent>
          </Tooltip>
        </p>
        <p className="font-serif text-[#FDF8F5] text-[56px] leading-none mb-1">
          {stats.ecua_m.toFixed(1)}
        </p>
        <p className="font-sans text-[#D8D2CC] text-[14px] opacity-60">
          etapas completadas por usuária ativa este mês · meta: acima de 1.5
        </p>
        <div className="mt-4 w-full h-2 bg-white/10 rounded-full">
          <div
            className="h-2 bg-[#C96B3E] rounded-full transition-all"
            style={{ width: `${Math.min((stats.ecua_m / 3) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {metricas.map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)]"
          >
            <p className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2 flex items-center gap-1">
              <span>
                {item.label}
                {item.sigla ? ` ${item.sigla}` : ""}
              </span>
              {item.tooltip && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`O que é ${item.sigla ?? item.label}`}
                      className="inline-flex items-center justify-center min-h-[20px] min-w-[20px] text-[#1A1A2E]/40 hover:text-[#1A1A2E]/70"
                    >
                      <HelpCircle size={11} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{item.tooltip}</TooltipContent>
                </Tooltip>
              )}
            </p>
            <p
              className={`font-serif text-[32px] leading-none mb-1 ${item.ok ? "text-[#2D6A4F]" : "text-[#C0392B]"}`}
            >
              {item.valor}
            </p>
            <p className="font-sans text-[#1A1A2E] text-[11px] opacity-40">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-6">
        <p className="font-mono text-[10px] tracking-[2px] uppercase text-[#1A1A2E] opacity-40">
          ATENÇÃO IMEDIATA
        </p>
        {alertasVermelhos.length === 0 ? (
          <div className="bg-[rgba(44,106,79,0.04)] border border-[rgba(44,106,79,0.1)] rounded-xl p-4">
            <p className="font-sans text-[#2D6A4F] text-[13px] opacity-70">
              Nenhum alerta crítico no momento.
            </p>
          </div>
        ) : (
          alertasVermelhos.map((u) => (
            <div
              key={u.id}
              className="bg-[rgba(192,57,43,0.06)] border border-[rgba(192,57,43,0.20)] rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-sans text-[#C0392B] text-[13px] font-medium">
                  {u.nome} · parada há {u.dias_parada} dias na Etapa {u.etapa_atual}
                </p>
                <p className="font-sans text-[#1A1A2E] text-[12px] opacity-50">
                  última atividade: {u.ultima_atividade}
                </p>
              </div>
              <Link
                to="/admin/usuarios/$id"
                params={{ id: u.id }}
                className="font-sans text-[#C0392B] text-[12px] hover:underline"
              >
                Ver perfil →
              </Link>
            </div>
          ))
        )}
      </div>

      {/* SAÚDE DO SISTEMA (24h) — dados reais de edge_function_logs */}
      <p className="font-mono text-[10px] tracking-[2px] uppercase text-[#1A1A2E] opacity-40 mb-3">
        SAÚDE DO SISTEMA · 24H
      </p>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Eventos", valor: String(saude.eventos24h), cor: "#1A7FAD" },
          {
            label: "Erros",
            valor: String(saude.erros24h),
            cor: saude.erros24h > 0 ? "#C0392B" : "#2D6A4F",
          },
          { label: "Latência média", valor: `${saude.latencia} ms`, cor: "#1A1A2E" },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)]"
          >
            <p className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">
              {m.label}
            </p>
            <p className="font-serif text-[32px] leading-none" style={{ color: m.cor }}>
              {m.valor}
            </p>
          </div>
        ))}
      </div>

      {/* CENSO DE DADOS — contagens reais das tabelas que o admin enxerga */}
      <div className="bg-white rounded-2xl p-6 border border-[rgba(26,26,46,0.06)] mb-6">
        <p className="font-mono text-[10px] tracking-[2px] uppercase text-[#1A1A2E] opacity-40 mb-4">
          CENSO DE DADOS
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {censo.map((c) => (
            <div key={c.label}>
              <p className="font-serif text-[28px] leading-none text-[#1A1A2E]">{c.valor}</p>
              <p className="font-sans text-[12px] text-[#1A1A2E] opacity-50 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-[rgba(26,26,46,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-1">
              LISTA DE ESPERA
            </p>
            <p className="font-serif text-[#1A1A2E] text-[32px]">{stats.lista_espera_total}</p>
          </div>
          <Link to="/admin/cms" className="font-sans text-[#C96B3E] text-[13px] hover:underline">
            Gerenciar →
          </Link>
        </div>
      </div>
    </TooltipProvider>
  );
}
