import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [{ title: "Logs do sistema · Pólia" }],
  }),
  component: AdminLogs,
});

function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const dia = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("edge_function_logs")
        .select("*")
        .gte("created_at", dia)
        .order("created_at", { ascending: false });
      setLogs(data ?? []);
    })();
  }, []);

  const stats = useMemo(() => {
    const map = new Map<
      string,
      { chamadas: number; erros: number; soma_lat: number; com_lat: number }
    >();
    logs.forEach((l: any) => {
      const cur = map.get(l.function_name) ?? { chamadas: 0, erros: 0, soma_lat: 0, com_lat: 0 };
      cur.chamadas++;
      if (l.status !== "ok") cur.erros++;
      if (l.latency_ms != null) {
        cur.soma_lat += l.latency_ms;
        cur.com_lat++;
      }
      map.set(l.function_name, cur);
    });
    return Array.from(map.entries()).map(([nome, v]) => ({
      nome,
      chamadas: v.chamadas,
      erros: v.erros,
      latencia_ms: v.com_lat ? Math.round(v.soma_lat / v.com_lat) : 0,
    }));
  }, [logs]);

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-6">Logs do sistema</h1>
      <h2 className="font-serif text-[#1A1A2E] text-[24px] mb-4">Edge Functions · últimas 24h</h2>
      <div className="bg-white rounded-2xl border border-[rgba(26,26,46,0.06)] overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[rgba(26,26,46,0.06)]">
              {["Função", "Chamadas", "Erros", "Latência média", "Status"].map((h) => (
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
            {stats.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center font-sans text-[#1A1A2E] text-[13px] opacity-40"
                >
                  Nenhum log registrado nas últimas 24h.
                </td>
              </tr>
            )}
            {stats.map((fn) => (
              <tr key={fn.nome} className="border-b border-[rgba(26,26,46,0.04)]">
                <td className="px-5 py-3 font-mono text-[#1A1A2E] text-[13px]">{fn.nome}</td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px]">{fn.chamadas}</td>
                <td
                  className={`px-5 py-3 font-sans text-[13px] ${fn.erros > 0 ? "text-[#C9407A]" : "text-[#2D6A4F]"}`}
                >
                  {fn.erros}
                </td>
                <td className="px-5 py-3 font-sans text-[#1A1A2E] text-[13px] opacity-60">
                  {fn.latencia_ms}ms
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`font-mono text-[9px] tracking-[1px] uppercase px-2 py-0.5 rounded-full ${
                      fn.erros === 0
                        ? "bg-[rgba(44,106,79,0.1)] text-[#2D6A4F]"
                        : "bg-[rgba(201,64,122,0.1)] text-[#C9407A]"
                    }`}
                  >
                    {fn.erros === 0 ? "ok" : "com erros"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
