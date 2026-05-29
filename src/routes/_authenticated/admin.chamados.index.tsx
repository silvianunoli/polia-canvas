import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/chamados/")({
  head: () => ({
    meta: [{ title: "Chamados · Pólia" }],
  }),
  component: AdminChamados,
});

function AdminChamados() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"aberto" | "em_andamento" | "resolvido">("aberto");
  const [counts, setCounts] = useState({ aberto: 0, em_andamento: 0, resolvido: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id,title,status,priority,module_ref,created_at,user_id")
        .eq("status", filtroStatus)
        .order("created_at", { ascending: false });

      const userIds = Array.from(new Set((data ?? []).map((t: any) => t.user_id)));
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id", userIds)
        : { data: [] as any[] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      setTickets((data ?? []).map((t: any) => ({ ...t, user_nome: map.get(t.user_id) ?? "—" })));

      const [{ count: a }, { count: e }, { count: r }] = await Promise.all([
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "aberto"),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "em_andamento"),
        supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "resolvido"),
      ]);
      setCounts({ aberto: a ?? 0, em_andamento: e ?? 0, resolvido: r ?? 0 });
    })();
  }, [filtroStatus]);

  return (
    <>
      <h1 className="font-serif text-[#1A1A2E] text-[40px] mb-6">Chamados</h1>
      <div className="flex gap-2 mb-6">
        {(["aberto", "em_andamento", "resolvido"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`font-mono text-[10px] tracking-[1px] uppercase px-4 py-2 rounded-full transition-all ${
              filtroStatus === s
                ? "bg-[#1A1A2E] text-[#FDF8F5]"
                : "border border-[rgba(26,26,46,0.12)] text-[#1A1A2E] opacity-60 hover:opacity-100"
            }`}
          >
            {s.replace("_", " ")} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)] cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => navigate({ to: "/admin/chamados/$id", params: { id: ticket.id } })}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {ticket.priority === "urgente" && (
                    <span className="font-mono text-[9px] tracking-[1px] uppercase bg-[rgba(201,64,122,0.1)] text-[#C9407A] px-2 py-0.5 rounded-full">
                      urgente
                    </span>
                  )}
                  {ticket.module_ref && (
                    <span className="font-mono text-[9px] tracking-[1px] uppercase bg-[rgba(26,26,46,0.06)] text-[#1A1A2E] opacity-50 px-2 py-0.5 rounded-full">
                      {ticket.module_ref}
                    </span>
                  )}
                </div>
                <p className="font-sans text-[#1A1A2E] text-[15px] font-medium">{ticket.title}</p>
                <p className="font-sans text-[#1A1A2E] text-[13px] opacity-40">
                  {ticket.user_nome} · {new Date(ticket.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <div className="bg-white rounded-2xl p-8 border border-[rgba(26,26,46,0.06)] text-center">
            <p className="font-sans text-[#1A1A2E] text-[13px] opacity-50">Nenhum chamado nesse status.</p>
          </div>
        )}
      </div>
    </>
  );
}
