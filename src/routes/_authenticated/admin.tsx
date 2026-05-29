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
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
      setNome(p?.full_name ?? "");
      const { count } = await supabase.from("tickets").select("*", { count: "exact", head: true }).eq("status", "aberto");
      setTicketsAbertos(count ?? 0);
    })();
  }, []);

  const items = [
    { href: "/admin", label: "Visão geral" },
    { href: "/admin/funil", label: "Funil de jornada" },
    { href: "/admin/usuarios", label: "Usuárias" },
    { href: "/admin/chamados", label: `Chamados${ticketsAbertos > 0 ? ` (${ticketsAbertos})` : ""}` },
    { href: "/admin/feedback", label: "Feedback" },
    { href: "/admin/cms", label: "CMS" },
    { href: "/admin/comunicacao", label: "Comunicação" },
    { href: "/admin/logs", label: "Logs do sistema" },
    { href: "/admin/flags", label: "Feature Flags" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5FA] flex">
      <aside className="w-[220px] bg-white border-r border-[rgba(26,26,46,0.06)] flex flex-col py-6 px-4 fixed h-full">
        <p className="font-serif text-[#1A1A2E] text-[18px] mb-1">Pólia Admin</p>
        <p className="font-sans text-[#C96B3E] text-[11px] mb-8">{nome}</p>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = location.pathname === item.href || (item.href !== "/admin" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`font-sans text-[14px] px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? "bg-[rgba(201,107,62,0.08)] text-[#C96B3E] font-medium"
                    : "text-[#1A1A2E] opacity-60 hover:opacity-100 hover:bg-[rgba(26,26,46,0.04)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <Link to="/painel" className="font-sans text-[#1A1A2E] text-[12px] opacity-40 hover:opacity-70">
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
