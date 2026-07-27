import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { CsatPrompt } from "@/components/csat/CsatPrompt";
import { useCsatTrigger } from "@/hooks/useCsatTrigger";
import { rotaLiberada } from "@/lib/planos";

// Flag própria (não a chave interna do supabase-js, que ele mesmo limpa
// assim que detecta um token inválido/vencido — checar essa chave depois
// perderia a corrida quase sempre). Marcada sempre que uma sessão válida é
// vista; se sumir depois, foi expiração, não primeiro acesso.
const TEVE_SESSAO_KEY = "polia-teve-sessao";

// Rotas fora da trava de plano: o funil de pagamento e a própria tela de
// upgrade, pra não virar loop de redirect. Admin/blog-admin/design-system
// foram extraídos pro polia-admin (27/07/2026) — não existem mais aqui.
function isentoDeAssinatura(pathname: string): boolean {
  return pathname === "/onboarding" || pathname === "/assinar" || pathname === "/upgrade";
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // NOTA DE SEGURANÇA: este guard é client-only (retorna no SSR logo abaixo) e
    // serve pra NAVEGAÇÃO, não como fronteira de segurança. A entitlement real é
    // imposta no banco por RLS — a usuária não forja `plano` (congelado na policy
    // de update, migração 20260709170000). Furar este redirect no máximo deixa
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

        // profiles.plano é a fonte única do direito de acesso (o webhook do
        // Stripe já grava 'cancelada' no cancelamento — não precisa de uma
        // segunda leitura em `assinaturas` aqui).
        if (!rotaLiberada(location.pathname, profile.plano)) {
          // rotaLiberada só devolve false quando a rota exige tier "controle"
          // (rota "confere" nunca é bloqueada) — "controle" é sempre o plano
          // certo pra nomear aqui.
          throw redirect({
            to: "/upgrade",
            search: { rota: location.pathname, tier: "controle" },
          });
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

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Pulso de relacionamento: fora das rotas isentas de assinatura (funil de
  // pagamento e admin/blog-admin, que têm público e propósito diferentes).
  const csatPulso = useCsatTrigger(
    "pulso_periodico",
    "pulso_relacionamento",
    !isentoDeAssinatura(pathname),
  );
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
      </div>
      {csatPulso.mostrar && (
        <CsatPrompt
          pergunta="Como está sendo usar a Pólia?"
          onFechar={csatPulso.fechar}
          onEnviar={csatPulso.enviar}
        />
      )}
    </div>
  );
}
