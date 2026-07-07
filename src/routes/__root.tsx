import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { CookieConsent } from "@/components/ui/CookieConsent";
import { ErrorPage, type ErrorPageProps } from "@/components/layout/ErrorPage";
import { SiteErrorPage } from "@/components/layout/SiteErrorPage";
import { DiagnosticPanel } from "@/components/DiagnosticPanel";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Inter:wght@400;500;600;700&family=DM+Sans:wght@700&family=Caveat:wght@400;600&display=swap",
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
      {import.meta.env.DEV && <DiagnosticPanel />}
    </QueryClientProvider>
  );
}
