import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/usuarios/")({
  head: () => ({
    meta: [{ title: "Usuárias · Pólia" }],
  }),
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,etapa_atual,streak,updated_at,created_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      setUsuarios(data ?? []);
    })();
  }, []);

  const filtradas = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtroEtapa && String(u.etapa_atual) !== filtroEtapa) return false;
      if (busca && !(u.full_name?.toLowerCase().includes(busca.toLowerCase()))) return false;
      return true;
    });
  }, [usuarios, filtroEtapa, busca]);

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-6">Usuárias</h1>
      <div className="flex gap-3 mb-6">
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
          className="font-sans text-[14px] border border-[rgba(26,26,46,0.12)] rounded-xl px-4 py-2 bg-white flex-1"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[rgba(26,26,46,0.06)] overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[rgba(26,26,46,0.06)]">
              {["Nome", "Etapa atual", "Streak", "Última atividade", "Desde"].map((h) => (
                <th key={h} className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 px-5 py-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((u) => (
              <tr
                key={u.id}
                className="border-b border-[rgba(26,26,46,0.04)] hover:bg-[rgba(26,26,46,0.02)] cursor-pointer"
                onClick={() => navigate({ to: "/admin/usuarios/$id", params: { id: u.id } })}
              >
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[14px]">{u.full_name ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className="font-mono text-[10px] tracking-[1px] uppercase bg-[rgba(201,107,62,0.08)] text-[#C96B3E] px-2 py-1 rounded-full">
                    E{u.etapa_atual}
                  </span>
                </td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[14px]">{u.streak ?? 0} dias</td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-50">
                  {new Date(u.updated_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-50">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center font-sans text-[#1A1A2E] text-[13px] opacity-40">
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
