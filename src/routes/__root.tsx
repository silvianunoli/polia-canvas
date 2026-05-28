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
import { StarField } from "@/components/ui/StarField";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div
      style={{
        background: "var(--azul-noite)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <NotFoundStars />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          padding: 24,
        }}
      >
        <div
          className="font-caveat"
          style={{ fontSize: 20, color: "var(--terracota)", marginBottom: 20 }}
        >
          ops.
        </div>
        <div style={{ position: "relative" }}>
          <div
            className="font-serif"
            aria-hidden
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -55%)",
              fontSize: 160,
              lineHeight: 1,
              color: "rgba(255,255,255,0.08)",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            404
          </div>
          <h1
            className="font-serif"
            style={{
              position: "relative",
              fontSize: 40,
              lineHeight: 1.2,
              color: "#fff",
              margin: 0,
            }}
          >
            Essa estrela ainda não existe.
          </h1>
        </div>
        <p
          className="font-sans"
          style={{
            fontSize: 17,
            color: "rgba(255,255,255,0.55)",
            marginTop: 16,
            lineHeight: 1.6,
          }}
        >
          Mas a sua jornada continua por aqui.
        </p>
        <p
          className="font-caveat"
          style={{ fontSize: 18, color: "rgba(255,255,255,0.40)", marginTop: 8 }}
        >
          Deixa a Pólia te guiar de volta.
        </p>
        <div style={{ marginTop: 40 }}>
          <Link
            to="/"
            className="font-sans"
            style={{
              background: "var(--terracota)",
              color: "#fff",
              fontSize: 17,
              fontWeight: 600,
              padding: "18px 48px",
              borderRadius: 12,
              display: "inline-block",
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(201,107,62,0.25)",
            }}
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFoundStars() {
  return <StarField density={40} speed={0.4} />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
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
      <Toaster richColors position="top-center" theme="dark" />
    </QueryClientProvider>
  );
}
