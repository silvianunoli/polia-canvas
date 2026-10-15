import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";

// O onboarding de 5 passos saiu em 14/10/2026 (desenho aprovado pela Sil): a
// conta nova entra direto no Painel, que abre com o bloco "Primeiros passos"
// (components/painel/PrimeirosPassos.tsx). O que o fim do onboarding fazia
// (onboarding_completed, evento do Founder Dashboard, e-mail de boas-vindas)
// mudou pro Painel, em hooks/usePrimeirosPassos.ts.
//
// A rota continua existindo só como redirect: link de confirmação de e-mail
// já enviado, o lembrete de conta (edge function lembretes-conta) e favoritos
// antigos apontam pra /onboarding.
//
// Só no client, como o guard da área logada: o link de confirmação chega aqui
// com a sessão no hash da URL, e o servidor não vê o hash. O guard pai já
// chamou getSession() (que lê o hash e cria a sessão) antes deste redirect.
export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Pólia One" }] }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    throw redirect({ to: "/painel", replace: true });
  },
  component: OnboardingRedirect,
});

function OnboardingRedirect() {
  return <Navigate to="/painel" replace />;
}
