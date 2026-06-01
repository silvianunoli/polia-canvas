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
import { ErrorPage } from "@/components/layout/ErrorPage";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return <ErrorPage code="404" />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <ErrorPage
      code="500"
      ctaLabel="Tentar de novo"
      onCta={() => {
        router.invalidate();
        reset();
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
      { name: "description", content: "Pólia, plataforma guiada para mulheres empreendedoras brasileiras." },
      { name: "author", content: "Pólia" },
      { property: "og:title", content: "Pólia" },
      { property: "og:description", content: "Pólia, plataforma guiada para mulheres empreendedoras brasileiras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Pólia" },
      { name: "twitter:description", content: "Pólia, plataforma guiada para mulheres empreendedoras brasileiras." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0f5c77a7-73cf-46e8-ba6d-11e724073022/id-preview-06d80276--98e74367-7843-48ef-9220-4aa0d3ef55fb.lovable.app-1779750459502.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0f5c77a7-73cf-46e8-ba6d-11e724073022/id-preview-06d80276--98e74367-7843-48ef-9220-4aa0d3ef55fb.lovable.app-1779750459502.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&family=DM+Sans:wght@700&family=Caveat:wght@400;600&display=swap",
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

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" theme="light" />
      <CookieConsent />
    </QueryClientProvider>
  );
}
