import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PoliaFooter } from "@/components/layout/PoliaFooter";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

// Rotas que mostram o footer (admin/config/auth-like).
// Rotas operacionais (Painel, Jornada, Tarefas, Clientes, Vitrine, Financeiro,
// Biblioteca, Etapa) ficam sem footer pra evitar ruído no flow de trabalho.
const FOOTER_PATHS = ["/configuracoes", "/admin"];

function showFooterFor(pathname: string) {
  return FOOTER_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const withFooter = showFooterFor(pathname);
  return (
    <>
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <main id="main-content">
        <Outlet />
      </main>
      {withFooter && <PoliaFooter />}
    </>
  );
}
