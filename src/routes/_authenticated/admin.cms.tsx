import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/cms")({
  head: () => ({
    meta: [{ title: "CMS · Pólia" }],
  }),
  component: AdminCms,
});

function AdminCms() {
  const [espera, setEspera] = useState<Tables<"lista_espera">[]>([]);

  useEffect(() => {
    (async () => {
      const { data: e } = await supabase
        .from("lista_espera")
        .select("*")
        .order("criado_em", { ascending: false });
      setEspera(e ?? []);
    })();
  }, []);

  const exportarCsv = () => {
    const linhas = [["nome", "email", "tipo_negocio", "data"]];
    espera.forEach((e) => linhas.push([e.nome, e.email, e.tipo_negocio ?? "", e.criado_em]));
    const csv = linhas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-espera.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-6">CMS</h1>

      <div className="flex justify-between items-center mb-5">
        <h2 className="font-serif text-[#1A1A2E] text-[28px]">{espera.length} na lista</h2>
        <button
          onClick={exportarCsv}
          className="font-sans text-[#C96B3E] text-[14px] border border-[rgba(201,107,62,0.3)] rounded-xl px-5 py-2 hover:bg-[rgba(201,107,62,0.06)] transition-colors"
        >
          Exportar CSV
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-[rgba(26,26,46,0.06)] overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[rgba(26,26,46,0.06)]">
              {["Nome", "Email", "Tipo de negócio", "Data"].map((h) => (
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
            {espera.map((item) => (
              <tr key={item.id} className="border-b border-[rgba(26,26,46,0.04)]">
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[14px]">{item.nome}</td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-60">
                  {item.email}
                </td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-60">
                  {item.tipo_negocio ?? "—"}
                </td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[12px] opacity-40">
                  {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
