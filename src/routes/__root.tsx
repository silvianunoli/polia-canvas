import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { CookieConsent } from "@/components/ui/CookieConsent";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ErrorPage, type ErrorPageProps } from "@/components/layout/ErrorPage";
import { SiteErrorPage } from "@/components/layout/SiteErrorPage";
import { DiagnosticPanel } from "@/components/DiagnosticPanel";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { track } from "@/lib/analytics";
import { logErroCliente } from "@/lib/error-log";
import { DOMINIO_GESTAO, caminhoPermitidoNoDominioGestao } from "@/lib/dominio-gestao";

import appCss from "../styles.css?url";

const MODO_MANUTENCAO = import.meta.env.VITE_MODO_MANUTENCAO === "true";

// Rotas compartilhadas (404/500/manutenção/offline) têm duas peles: quem está
// deslogada vê o chrome do site (cabeçalho/rodapé); quem está logada vê a
// versão mínima sem navegação (já era assim). Enquanto a sessão ainda carrega,
// mostra a mínima pra não trocar de chrome no meio do carregamento.
function AutoChromeErrorPage(props: ErrorPageProps) {
  const { user, loading } = useSupabaseSession();
  if (!loading && !user) return <SiteErrorPage {...props} />;
  return <ErrorPage {...props} />;
}

function NotFoundComponent() {
  return <AutoChromeErrorPage code="404" />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[${errorId}]`, error);
  useEffect(() => {
    logErroCliente(error.message, error.stack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const router = useRouter();
  return (
    <AutoChromeErrorPage
      code="500"
      errorId={errorId}
      primaryAction={{
        label: "Tentar de novo",
        onClick: () => {
          router.invalidate();
          reset();
        },
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pólia" },
      {
        name: "description",
        content: "Pólia, plataforma guiada para mulheres empreendedoras brasileiras.",
      },
      { name: "author", content: "Pólia" },
      { property: "og:title", content: "Pólia" },
      {
        property: "og:description",
        content: "Pólia, plataforma guiada para mulheres empreendedoras brasileiras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Pólia" },
      {
        name: "twitter:description",
        content: "Pólia, plataforma guiada para mulheres empreendedoras brasileiras.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0f5c77a7-73cf-46e8-ba6d-11e724073022/id-preview-06d80276--98e74367-7843-48ef-9220-4aa0d3ef55fb.lovable.app-1779750459502.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0f5c77a7-73cf-46e8-ba6d-11e724073022/id-preview-06d80276--98e74367-7843-48ef-9220-4aa0d3ef55fb.lovable.app-1779750459502.png",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Fraunces:ital,opsz,wght@1,9..144,400..600&family=Inter:wght@400;500;600;700&family=DM+Sans:wght@700&family=Caveat:wght@400;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,600,700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const router = useRouter();
  const { queryClient } = Route.useRouteContext();
  const online = useOnlineStatus();

  // Pageview automático em toda página, pública ou logada — um hook aqui
  // no root cobre todas as rotas, sem precisar instrumentar cada uma.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    track("pageview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // src/server.ts já bloqueia isso na entrada, mas navegação dentro do SPA
  // (client-side, via <Link>) nunca passa pelo servidor — sem essa trava
  // aqui, qualquer link pro site público navegado de dentro do /admin
  // renderizava a página normalmente no domínio de gestão.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname !== DOMINIO_GESTAO) return;
    if (caminhoPermitidoNoDominioGestao(pathname)) return;
    window.location.href = `https://usepolia.com.br${pathname}${window.location.search}`;
  }, [pathname]);

  // Clique instrumentado por delegação: qualquer elemento com data-track vira
  // evento sem precisar importar/chamar track() em cada botão. Ver plano de
  // tagueamento — data-track-props é um JSON opcional com propriedades extras.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest<HTMLElement>("[data-track]");
      if (!el) return;
      const elemento = el.getAttribute("data-track");
      if (!elemento) return;
      const propsRaw = el.getAttribute("data-track-props");
      let props: Record<string, unknown> = {};
      if (propsRaw) {
        try {
          props = JSON.parse(propsRaw);
        } catch {
          // Atributo mal formado não pode quebrar o clique da usuária.
        }
      }
      track("click", { elemento, ...props });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Captura erro de JS não tratado e promise rejeitada fora da árvore React
  // (o ErrorComponent do router já cobre erro de rota/loader).
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      logErroCliente(event.message, event.error?.stack);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      logErroCliente(
        reason instanceof Error ? reason.message : String(reason),
        reason instanceof Error ? reason.stack : undefined,
      );
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  // Link de confirmação de e-mail vencido/já usado: o Supabase volta com o
  // erro no hash da URL (não dá pro servidor ver, só o client). O link de
  // confirmação aponta pro /onboarding — redefinir-senha.tsx já trata o caso
  // dela mesma, então aqui só cobre o resto (a confirmação de cadastro).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const linkVencido = hash.includes("otp_expired") || hash.includes("access_denied");
    if (linkVencido && window.location.pathname !== "/auth/redefinir-senha") {
      router.navigate({ to: "/auth/link-expirado", search: { tipo: "confirmacao" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {MODO_MANUTENCAO ? (
        <AutoChromeErrorPage code="manutencao" />
      ) : !online ? (
        <AutoChromeErrorPage
          code="offline"
          primaryAction={{ label: "Tentar de novo", onClick: () => window.location.reload() }}
        />
      ) : (
        <Outlet />
      )}
      <Toaster
        position="bottom-right"
        theme="light"
        toastOptions={{
          classNames: {
            toast: "polia-v3 rounded-lg border font-sans",
            title: "text-[var(--ink)]",
            description: "text-[var(--ink-soft)]",
            success: "!border-[var(--secondary)]",
            error: "!border-[var(--danger)]",
            info: "!border-[var(--line)]",
          },
        }}
      />
      <CookieConsent />
      <GoogleAnalytics />
      {import.meta.env.DEV && <DiagnosticPanel />}
    </QueryClientProvider>
  );
}
