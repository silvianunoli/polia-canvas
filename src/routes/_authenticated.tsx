import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PoliaFooter } from "@/components/layout/PoliaFooter";
import { Sidebar } from "@/components/layout/Sidebar";

// Flag própria (não a chave interna do supabase-js, que ele mesmo limpa
// assim que detecta um token inválido/vencido — checar essa chave depois
// perderia a corrida quase sempre). Marcada sempre que uma sessão válida é
// vista; se sumir depois, foi expiração, não primeiro acesso.
const TEVE_SESSAO_KEY = "polia-teve-sessao";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      localStorage.setItem(TEVE_SESSAO_KEY, "1");
      return;
    }
    const expirou = localStorage.getItem(TEVE_SESSAO_KEY) === "1";
    throw redirect({
      to: "/auth/login",
      search: {
        // location.href do TanStack Router já é só pathname+search+hash
        // (sem origin) — seguro pra usar como destino de redirect.
        next: location.href,
        ...(expirou ? { motivo: "sessao-expirada" as const } : {}),
      },
    });
  },
  component: AuthenticatedLayout,
});

// Só o painel admin mostra o footer. As páginas do produto (Painel, Jornada,
// Tarefas, Clientes, Financeiro, Biblioteca, Etapa, Configurações) ficam sem
// footer pra manter a mesma proposta limpa no flow de trabalho.
const FOOTER_PATHS = ["/admin"];

function showFooterFor(pathname: string) {
  return FOOTER_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const withFooter = showFooterFor(pathname);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main-content" className="flex-1">
          <Outlet />
        </main>
        {withFooter && <PoliaFooter />}
      </div>
    </div>
  );
}
