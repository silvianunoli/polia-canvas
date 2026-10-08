import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  consumirLoginPendente,
  montarHeartbeat,
  registrarAberturaDeTela,
} from "@/lib/founder-eventos";
import { gtagEvent } from "@/lib/gtag";
import { Sidebar } from "@/components/layout/Sidebar";
import { CsatPrompt } from "@/components/csat/CsatPrompt";
import { LembretePlanejamento } from "@/components/dicas/LembretePlanejamento";
import { ConviteTutorial } from "@/components/dicas/ConviteTutorial";
import { AssistenteProvider } from "@/components/assistente/AssistenteContext";
import { AssistenteFlutuante } from "@/components/assistente/AssistenteFlutuante";
import { useCsatTrigger } from "@/hooks/useCsatTrigger";
import { rotaLiberada, tierPagoDaRota } from "@/lib/planos";
import { precisaCriarSenha } from "@/lib/senha";
import { gravarOrigemDoOAuth } from "@/lib/gravarOrigemOAuth";

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

      // Conta criada pela compra em /planos ainda sem senha: sem isso, ela
      // usa uma vez e não consegue voltar depois de sair (QA-03).
      if (precisaCriarSenha(data.session.user.user_metadata)) {
        throw redirect({ to: "/auth/criar-senha" });
      }

      if (!isentoDeAssinatura(location.pathname)) {
        const { data: profile, error: erroPerfil } = await supabase
          .from("profiles")
          .select("onboarding_completed, plano")
          .eq("id", data.session.user.id)
          .maybeSingle();

        // Leitura que falhou não é "perfil sem onboarding" nem "plano Grátis":
        // mandar pro /onboarding ou pro /upgrade por erro de rede jogava quem
        // paga num fluxo errado. Deixa passar; a tela trata a própria leitura e
        // o direito real continua imposto por RLS (ver nota acima).
        if (erroPerfil) return;

        if (!profile?.onboarding_completed) {
          throw redirect({ to: "/onboarding" });
        }

        // profiles.plano é a fonte única do direito de acesso (o webhook do
        // Stripe já grava 'cancelada' no cancelamento — não precisa de uma
        // segunda leitura em `assinaturas` aqui).
        if (!rotaLiberada(location.pathname, profile.plano)) {
          // O plano a nomear na tela de upgrade é o que a ROTA exige, não um
          // fixo: /raiox, /projecao e /plano-conteudo são do Pro. Com "controle"
          // fixo, a usuária do Grátis via "Recurso do plano Premium", assinava
          // o Premium e continuava barrada pelo portão Pro de dentro da página.
          throw redirect({
            to: "/upgrade",
            search: { rota: location.pathname, tier: tierPagoDaRota(location.pathname) },
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
  // pagamento — onboarding, assinar, upgrade —, que tem público e propósito
  // diferente do resto da área logada).
  const csatPulso = useCsatTrigger(
    "pulso_periodico",
    "pulso_relacionamento",
    !isentoDeAssinatura(pathname),
  );

  // Instrumentação do Founder Dashboard: cada tela da área logada vira um
  // feature_opened; o heartbeat mede a duração da sessão.
  useEffect(() => {
    void consumirLoginPendente().then((evento) => {
      // Cadastro pelo Google também conta como conversão no GA4 (FUN-09).
      if (evento === "signup") gtagEvent("sign_up", { method: "google" });
    });
    registrarAberturaDeTela(pathname);
  }, [pathname]);
  useEffect(() => montarHeartbeat(), []);
  // Cadastro pelo Google vindo de landing de campanha: grava a origem na conta.
  useEffect(() => {
    void gravarOrigemDoOAuth();
  }, []);

  return (
    <AssistenteProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        {/* Onboarding é tela cheia, sem barra lateral (decisão da Sil, 05/10/2026):
          com o menu à vista dava pra sair no meio do fluxo. */}
        {pathname !== "/onboarding" && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main-content" tabIndex={-1} className="flex-1">
            <Outlet />
          </main>
        </div>
        <ConviteTutorial pathname={pathname} />
        <LembretePlanejamento pathname={pathname} />
        <AssistenteFlutuante pathname={pathname} />
        {csatPulso.mostrar && (
          <CsatPrompt
            pergunta="Como está sendo usar a Pólia One?"
            onFechar={csatPulso.fechar}
            onEnviar={csatPulso.enviar}
          />
        )}
      </div>
    </AssistenteProvider>
  );
}
