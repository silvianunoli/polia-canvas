import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Amostragem do SSR: 1:1 até 50 páginas/min por isolate, depois 1:10 — o
// que interessa é p95/erro, não cada pageview. Server functions são 1:1.
let janelaMinuto = 0;
let paginasNaJanela = 0;
function amostrarSsr(): boolean {
  const minuto = Math.floor(Date.now() / 60000);
  if (minuto !== janelaMinuto) {
    janelaMinuto = minuto;
    paginasNaJanela = 0;
  }
  paginasNaJanela += 1;
  return paginasNaJanela <= 50 || paginasNaJanela % 10 === 0;
}

// Medição da API pro Founder Dashboard (founder_api_chamadas). Importa o lado
// servidor dinamicamente pra nada disso chegar ao bundle do client.
const medirRequest = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const ehPagina =
    request.method === "GET" &&
    !url.pathname.startsWith("/_") &&
    !url.pathname.startsWith("/api") &&
    !/\.[a-z0-9]+$/i.test(url.pathname) &&
    (request.headers.get("accept") ?? "").includes("text/html");
  if (!ehPagina || !amostrarSsr()) return next();

  const t0 = Date.now();
  const resultado = await next();
  const status = resultado.response.status;
  void import("./lib/founder-eventos.server").then(({ registrarChamadaApi }) =>
    registrarChamadaApi({
      fn: url.pathname,
      tipo: "ssr",
      metodo: request.method,
      ok: status < 500,
      status,
      latenciaMs: Date.now() - t0,
    }),
  );
  return resultado;
});

const medirServerFn = createMiddleware({ type: "function" }).server(
  async ({ next, serverFnMeta }) => {
    const t0 = Date.now();
    let ok = true;
    let status = 200;
    try {
      return await next();
    } catch (error) {
      ok = false;
      status =
        error != null && typeof error === "object" && "statusCode" in error
          ? Number((error as { statusCode: unknown }).statusCode) || 500
          : 500;
      throw error;
    } finally {
      const latenciaMs = Date.now() - t0;
      const nome = serverFnMeta?.name || serverFnMeta?.id || "server_fn";
      void import("./lib/founder-eventos.server").then(
        async ({ registrarChamadaApi, registrarEventoSistema, subDoBearer }) => {
          let userId: string | null = null;
          try {
            userId = subDoBearer(getRequest()?.headers.get("authorization") ?? null);
          } catch {
            userId = null;
          }
          await registrarChamadaApi({
            fn: nome,
            tipo: "server_fn",
            ok,
            status,
            latenciaMs,
            userId,
          });
          if (!ok) {
            await registrarEventoSistema({
              tipo: "api_error",
              origem: "server_fn",
              servico: nome,
              detalhes: { status },
              latenciaMs,
            });
          }
        },
      );
    }
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, medirRequest],
  functionMiddleware: [attachSupabaseAuth, medirServerFn],
}));
