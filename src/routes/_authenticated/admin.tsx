import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Admin · Pólia" }],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth/login" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, full_name")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/painel" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  const [nome, setNome] = useState("");
  const [ticketsAbertos, setTicketsAbertos] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      setNome(p?.full_name ?? "");
      const { count } = await supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "aberto");
      setTicketsAbertos(count ?? 0);
    })();
  }, []);

  const items = [
    { href: "/admin", label: "Visão geral" },
    { href: "/admin/funil", label: "Funil de jornada" },
    { href: "/admin/negocio", label: "Negócio" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/pesquisas", label: "Pesquisas" },
    {
      href: "/admin/chamados",
      label: `Chamados${ticketsAbertos > 0 ? ` (${ticketsAbertos})` : ""}`,
    },
    { href: "/admin/qualidade", label: "Qualidade" },
    { href: "/admin/logs", label: "Logs do sistema" },
    { href: "/admin/alertas", label: "Alertas" },
    { href: "/admin/governanca", label: "Governança" },
    { href: "/admin/auditoria", label: "Auditoria" },
    { href: "/admin/flags", label: "Feature Flags" },
  ];

  return (
    <div className="polia-v3 flex min-h-screen bg-[var(--bg)]">
      <aside className="fixed flex h-full w-[220px] flex-col border-r border-[var(--line)] bg-white px-4 py-6">
        <p className="font-cabinet mb-1 text-[18px] text-[var(--ink)]">Pólia Admin</p>
        <p className="mb-8 font-sans text-[11px] text-[var(--secondary-text)]">{nome}</p>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              location.pathname === item.href ||
              (item.href !== "/admin" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`rounded-lg border-l-[3px] px-3 py-2 font-sans text-[14px] no-underline transition-colors ${
                  active
                    ? "border-[var(--secondary)] bg-[var(--secondary-light)] font-medium text-[var(--secondary-text)]"
                    : "border-transparent text-[var(--ink-soft)] hover:bg-[var(--surface)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <Link
            to="/painel"
            className="font-sans text-[12px] text-[var(--muted)] no-underline hover:text-[var(--ink-soft)]"
          >
            ← Voltar ao app
          </Link>
        </div>
      </aside>
      <main className="ml-[220px] flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
