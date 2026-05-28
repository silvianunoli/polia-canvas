import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
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
        supabase.from("profiles").select("id,created_at,star_1_completed_at").gte("created_at", dias30),
        supabase.from("profiles").select("etapa_atual").gt("etapa_atual", 0),
      ]);

      const wau2 = profilesAtivos?.length ?? 0;
      const etapas = (profilesAll ?? []).map((p: any) => p.etapa_atual).sort((a: number, b: number) => a - b);
      const medianaEtapa = etapas.length ? etapas[Math.floor(etapas.length / 2)] : 1;

      const ativacaoNum = (ativadasD7 ?? []).filter((p: any) => {
        if (!p.star_1_completed_at) return false;
        return new Date(p.star_1_completed_at).getTime() - new Date(p.created_at).getTime() <= 7 * 86400000;
      }).length;
      const ativacaoD7 = ativadasD7?.length ? Math.round((ativacaoNum / ativadasD7.length) * 100) : 0;

      // ECUA-M: total etapas completadas no mes / ativas
      const ecuaM = wau2 > 0 ? (profilesAtivos!.reduce((s: number, p: any) => s + (p.etapa_atual ?? 0), 0) / wau2) : 0;

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
        }))
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
    })();
  }, []);

  const metricas = [
    { label: "Ativação D7", valor: `${stats.ativacao_d7}%`, ok: stats.ativacao_d7 >= 40, desc: "completaram E1 em 7 dias" },
    { label: "Mediana de Etapa", valor: `E${stats.mediana_etapa}`, ok: true, desc: "onde metade das ativas está" },
    { label: "Ativas WAU-2", valor: stats.wau2, ok: true, desc: "últ. 14 dias com ação real" },
    { label: "Retenção D30", valor: `${stats.retencao_d30}%`, ok: stats.retencao_d30 >= 35, desc: "coorte do mês anterior" },
    { label: "Total cadastros", valor: stats.total_cadastros, ok: true, desc: "desde o início" },
  ];

  return (
    <>
      <div className="bg-[#1A1A2E] rounded-2xl p-8 mb-6">
        <p className="font-mono text-[#C96B3E] text-[10px] tracking-[2px] uppercase mb-2">NORTH STAR · ECUA-M</p>
        <p className="font-serif text-[#FDF8F5] text-[56px] leading-none mb-1">{stats.ecua_m.toFixed(1)}</p>
        <p className="font-sans text-[#D8D2CC] text-[14px] opacity-60">
          etapas completadas por usuária ativa este mês · meta: acima de 1.5
        </p>
        <div className="mt-4 w-full h-2 bg-white/10 rounded-full">
          <div className="h-2 bg-[#C96B3E] rounded-full transition-all" style={{ width: `${Math.min((stats.ecua_m / 3) * 100, 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        {metricas.map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)]">
            <p className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-2">{item.label}</p>
            <p className={`font-serif text-[32px] leading-none mb-1 ${item.ok ? "text-[#1A1A2E]" : "text-[#C9407A]"}`}>{item.valor}</p>
            <p className="font-sans text-[#1A1A2E] text-[11px] opacity-40">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-6">
        <p className="font-mono text-[10px] tracking-[2px] uppercase text-[#1A1A2E] opacity-40">ATENÇÃO IMEDIATA</p>
        {alertasVermelhos.length === 0 ? (
          <div className="bg-[rgba(44,106,79,0.04)] border border-[rgba(44,106,79,0.1)] rounded-xl p-4">
            <p className="font-sans text-[#2D6A4F] text-[13px] opacity-70">Nenhum alerta crítico no momento.</p>
          </div>
        ) : (
          alertasVermelhos.map((u) => (
            <div key={u.id} className="bg-[rgba(201,64,122,0.06)] border border-[rgba(201,64,122,0.2)] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-sans text-[#C9407A] text-[13px] font-medium">
                  {u.nome} — parada há {u.dias_parada} dias na Etapa {u.etapa_atual}
                </p>
                <p className="font-sans text-[#1A1A2E] text-[12px] opacity-50">última atividade: {u.ultima_atividade}</p>
              </div>
              <Link to="/admin/usuarios/$id" params={{ id: u.id }} className="font-sans text-[#C9407A] text-[12px] hover:underline">
                Ver perfil →
              </Link>
            </div>
          ))
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 border border-[rgba(26,26,46,0.06)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-1">LISTA DE ESPERA</p>
            <p className="font-serif text-[#1A1A2E] text-[32px]">{stats.lista_espera_total}</p>
          </div>
          <Link to="/admin/cms" className="font-sans text-[#C96B3E] text-[13px] hover:underline">
            Gerenciar →
          </Link>
        </div>
      </div>
    </>
  );
}
