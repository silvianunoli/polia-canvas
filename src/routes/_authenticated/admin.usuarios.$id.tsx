import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/usuarios/$id")({
  head: () => ({
    meta: [{ title: "Usuárias · Pólia" }],
  }),
  component: AdminUsuarioPerfil,
});

function AdminUsuarioPerfil() {
  const { id } = Route.useParams();
  const [usuario, setUsuario] = useState<any>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [totalEntregaveis, setTotalEntregaveis] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      setUsuario(data);
      const { count: ct } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("user_id", id);
      setTotalTickets(ct ?? 0);
      const { count: ce } = await supabase.from("entregaveis").select("*", { count: "exact", head: true }).eq("user_id", id);
      setTotalEntregaveis(ce ?? 0);
    })();
  }, [id]);

  if (!usuario) return <p className="font-sans text-[#1A1A2E] opacity-50">Carregando…</p>;

  return (
    <>
      <Link to="/admin/usuarios" className="font-sans text-[#C96B3E] text-[13px] hover:underline mb-3 inline-block">
        ← Usuárias
      </Link>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="font-mono text-[#C96B3E] text-[10px] tracking-[2px] uppercase mb-1">USUÁRIA</p>
          <h1 className="font-serif text-[#1A1A2E] text-[40px]">{usuario.full_name ?? "—"}</h1>
          <p className="font-sans text-[#1A1A2E] text-[14px] opacity-50">{usuario.business_name ?? ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Etapa atual", valor: `E${usuario.etapa_atual}` },
          { label: "Streak", valor: `${usuario.streak ?? 0} dias` },
          { label: "Entregáveis", valor: totalEntregaveis },
          { label: "Chamados", valor: totalTickets },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-5 border border-[rgba(26,26,46,0.06)]">
            <p className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#1A1A2E] opacity-40 mb-1">{item.label}</p>
            <p className="font-serif text-[#1A1A2E] text-[32px]">{item.valor}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-7 border border-[rgba(26,26,46,0.06)]">
        <p className="font-mono text-[9px] tracking-[2px] uppercase text-[#1A1A2E] opacity-40 mb-5">PERFIL</p>
        <dl className="space-y-2 font-sans text-[13px] text-[#1A1A2E]">
          <div className="flex gap-2"><dt className="opacity-50 w-40">Negócio:</dt><dd>{usuario.business_name ?? "—"}</dd></div>
          <div className="flex gap-2"><dt className="opacity-50 w-40">Tipo:</dt><dd>{usuario.business_type ?? "—"}</dd></div>
          <div className="flex gap-2"><dt className="opacity-50 w-40">Estágio:</dt><dd>{usuario.business_stage ?? "—"}</dd></div>
          <div className="flex gap-2"><dt className="opacity-50 w-40">Cliente:</dt><dd>{usuario.target_customer ?? "—"}</dd></div>
          <div className="flex gap-2"><dt className="opacity-50 w-40">Onboarding:</dt><dd>{usuario.onboarding_completed ? "completo" : "pendente"}</dd></div>
        </dl>
      </div>
    </>
  );
}
