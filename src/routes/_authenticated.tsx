import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PoliaFooter } from "@/components/layout/PoliaFooter";
import { Sidebar } from "@/components/layout/Sidebar";

// Flag própria (não a chave interna do supabase-js, que ele mesmo limpa
// assim que detecta um token inválido/vencido — checar essa chave depois
// perderia a corrida quase sempre). Marcada sempre que uma sessão válida é
// vista; se sumir depois, foi expiração, não primeiro acesso.
const TEVE_SESSAO_KEY = "polia-teve-sessao";

const STATUS_ATIVOS = ["active", "past_due", "trialing"];

// Rotas fora da trava de assinatura: o próprio funil de pagamento (pra não
// virar loop de redirect) e as áreas de admin/blog-admin, que já têm seu
// próprio guard por papel (is_admin) e não devem depender da assinatura de
// quem está logada pra gerenciar o app.
function isentoDeAssinatura(pathname: string): boolean {
  return (
    pathname === "/onboarding" ||
    pathname === "/assinar" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/blog-admin")
  );
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // NOTA DE SEGURANÇA: este guard é client-only (retorna no SSR logo abaixo) e
    // serve pra NAVEGAÇÃO, não como fronteira de segurança. A entitlement real é
    // imposta no banco por RLS — a usuária não forja `plano` (congelado na policy
    // de update, migração 20260709170000) nem `assinaturas.status` (sem policy de
    // escrita pra ela; só o webhook grava). Furar este redirect no máximo deixa
    // ver os PRÓPRIOS dados sem pagar; nunca dado de terceiros.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      localStorage.setItem(TEVE_SESSAO_KEY, "1");

      if (!isentoDeAssinatura(location.pathname)) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed, plano")
          .eq("id", data.session.user.id)
          .maybeSingle();

        if (!profile?.onboarding_completed) {
          throw redirect({ to: "/onboarding" });
        }

        // Contas beta (de antes do Stripe) ficam liberadas sem assinatura.
        if (profile.plano !== "beta") {
          const { data: assinatura } = await supabase
            .from("assinaturas" as never)
            .select("status")
            .eq("user_id", data.session.user.id)
            .maybeSingle();
          const status = (assinatura as { status: string } | null)?.status;
          const ativa = status ? STATUS_ATIVOS.includes(status) : false;
          if (!ativa) throw redirect({ to: "/assinar" });
        }
      }
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
