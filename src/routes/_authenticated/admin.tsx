import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/painel" });
  },
  component: AdminLayout,
});

// A navegação do admin mora no submenu "Administração" do Sidebar principal
// (src/components/layout/Sidebar.tsx) — este layout só aplica o escopo visual
// .polia-v3 e o respiro padrão, sem menu lateral próprio (o antigo aside fixo
// daqui competia de posição com o Sidebar global, que já é montado por
// _authenticated.tsx em toda rota autenticada).
function AdminLayout() {
  return (
    <div className="polia-v3 min-h-screen bg-[var(--bg)] p-8">
      <Outlet />
    </div>
  );
}
