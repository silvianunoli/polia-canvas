import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/usuarios/")({
  head: () => ({
    meta: [{ title: "Usuárias · Pólia" }],
  }),
  component: AdminUsuarios,
});

interface Usuaria {
  id: string;
  full_name: string | null;
  etapa_atual: number | null;
  streak: number | null;
  plano: string | null;
  onboarding_completed: boolean | null;
  updated_at: string;
  created_at: string;
}

type StatusKey = "ativa" | "morna" | "sumida" | "onboarding";

function statusKey(u: Usuaria): StatusKey {
  if (!u.onboarding_completed) return "onboarding";
  const dias = Math.floor((Date.now() - new Date(u.updated_at).getTime()) / 86_400_000);
  if (dias <= 7) return "ativa";
  if (dias > 30) return "sumida";
  return "morna";
}

const STATUS_META: Record<StatusKey, { label: string; bg: string; cor: string }> = {
  ativa: { label: "Ativa", bg: "rgba(45,106,79,0.1)", cor: "#2D6A4F" },
  morna: { label: "Morna", bg: "rgba(26,26,46,0.06)", cor: "#1A1A2E" },
  sumida: { label: "Sumida", bg: "rgba(201,64,122,0.1)", cor: "#C9407A" },
  onboarding: { label: "Onboarding", bg: "rgba(184,134,46,0.12)", cor: "#B8862E" },
};

function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuaria[]>([]);
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,etapa_atual,streak,plano,onboarding_completed,updated_at,created_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      setUsuarios((data ?? []) as Usuaria[]);
    })();
  }, []);

  const filtradas = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtroEtapa && String(u.etapa_atual) !== filtroEtapa) return false;
      if (filtroStatus && statusKey(u) !== filtroStatus) return false;
      if (busca && !u.full_name?.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [usuarios, filtroEtapa, filtroStatus, busca]);

  const contagem = useMemo(() => {
    const c: Record<StatusKey, number> = { ativa: 0, morna: 0, sumida: 0, onboarding: 0 };
    usuarios.forEach((u) => c[statusKey(u)]++);
    return c;
  }, [usuarios]);

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-2">Usuárias</h1>
      <p className="font-sans text-[14px] text-[#1A1A2E] opacity-50 mb-6">
        {contagem.ativa} ativas · {contagem.morna} mornas · {contagem.sumida} sumidas ·{" "}
        {contagem.onboarding} em onboarding
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="font-sans text-[14px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2 bg-white"
        >
          <option value="">Todos os status</option>
          <option value="ativa">Ativas (até 7 dias)</option>
          <option value="morna">Mornas (8–30 dias)</option>
          <option value="sumida">Sumidas (30+ dias)</option>
          <option value="onboarding">Onboarding pendente</option>
        </select>
        <select
          value={filtroEtapa}
          onChange={(e) => setFiltroEtapa(e.target.value)}
          className="font-sans text-[14px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2 bg-white"
        >
          <option value="">Todas as etapas</option>
          {Array.from({ length: 11 }).map((_, i) => (
            <option key={i} value={i + 1}>
              Etapa {i + 1}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Buscar por nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="font-sans text-[14px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2 bg-white flex-1 min-w-[180px]"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[rgba(26,26,46,0.06)] overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-[rgba(26,26,46,0.06)]">
              {[
                "Nome",
                "Status",
                "Plano",
                "Etapa atual",
                "Streak",
                "Última atividade",
                "Desde",
              ].map((h) => (
                <th
                  key={h}
                  className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 px-5 py-3 text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((u) => {
              const st = STATUS_META[statusKey(u)];
              return (
                <tr
                  key={u.id}
                  className="border-b border-[rgba(26,26,46,0.04)] hover:bg-[rgba(26,26,46,0.02)] cursor-pointer"
                  onClick={() => navigate({ to: "/admin/usuarios/$id", params: { id: u.id } })}
                >
                  <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[14px]">
                    {u.full_name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="font-sans text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: st.bg, color: st.cor }}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-[10px] tracking-[1px] uppercase bg-[rgba(26,26,46,0.05)] text-[#1A1A2E] opacity-70 px-2 py-1 rounded-full">
                      {u.plano ?? "beta"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-[10px] tracking-[1px] uppercase bg-[rgba(201,107,62,0.08)] text-[#C96B3E] px-2 py-1 rounded-full">
                      E{u.etapa_atual ?? 1}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[14px]">
                    {u.streak ?? 0} dias
                  </td>
                  <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-50">
                    {new Date(u.updated_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-50">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center font-sans text-[#1A1A2E] text-[13px] opacity-40"
                >
                  Nenhuma usuária encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
