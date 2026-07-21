import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { moduloInfo } from "@/lib/planejamento";

export const Route = createFileRoute("/_authenticated/admin/usuarios/$id")({
  head: () => ({
    meta: [{ title: "Usuárias · Pólia" }],
  }),
  component: AdminUsuarioPerfil,
});

function AdminUsuarioPerfil() {
  const { id } = Route.useParams();
  const [usuario, setUsuario] = useState<Tables<"profiles"> | null>(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [totalEntregaveis, setTotalEntregaveis] = useState(0);
  const [moduloAtual, setModuloAtual] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      setUsuario(data);
      const { count: ct } = await supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id);
      setTotalTickets(ct ?? 0);
      const { count: ce } = await supabase
        .from("entregaveis")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id);
      setTotalEntregaveis(ce ?? 0);
      const { data: secoes } = await supabase
        .from("planejamento_secoes")
        .select("modulo")
        .eq("user_id", id)
        .eq("concluido", true);
      const max = (secoes ?? []).reduce((m, s) => Math.max(m, s.modulo), 0);
      setModuloAtual(max);
    })();
  }, [id]);

  if (!usuario) return <p className="font-sans text-[var(--muted)]">Carregando…</p>;

  return (
    <>
      <Link
        to="/admin/crm"
        className="mb-3 inline-block font-sans text-[13px] text-[var(--secondary-text)] hover:underline"
      >
        ← CRM
      </Link>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-[2px] text-[var(--secondary-text)]">
            Usuária
          </p>
          <h1 className="font-cabinet text-[40px] text-[var(--ink)]">
            {usuario.full_name ?? "—"}
          </h1>
          <p className="font-sans text-[14px] text-[var(--muted)]">
            {usuario.business_name ?? ""}
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Módulo atual",
            valor: moduloAtual > 0 ? `M${moduloAtual} · ${moduloInfo(moduloAtual).nome}` : "não iniciou",
          },
          { label: "Streak", valor: `${usuario.streak ?? 0} dias` },
          { label: "Entregáveis", valor: totalEntregaveis },
          { label: "Chamados", valor: totalTickets },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-[1.5px] text-[var(--muted)]">
              {item.label}
            </p>
            <p className="font-cabinet text-[22px] leading-tight text-[var(--ink)]">
              {item.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white p-7">
        <p className="mb-5 font-sans text-[11px] font-semibold uppercase tracking-[2px] text-[var(--muted)]">
          Perfil
        </p>
        <dl className="space-y-2 font-sans text-[13px] text-[var(--ink)]">
          <div className="flex gap-2">
            <dt className="w-40 text-[var(--muted)]">Negócio:</dt>
            <dd>{usuario.business_name ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-[var(--muted)]">Tipo:</dt>
            <dd>{usuario.business_type ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-[var(--muted)]">Estágio:</dt>
            <dd>{usuario.business_stage ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-[var(--muted)]">Cliente:</dt>
            <dd>{usuario.target_customer ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-[var(--muted)]">Onboarding:</dt>
            <dd>{usuario.onboarding_completed ? "completo" : "pendente"}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
