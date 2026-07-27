import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { dispararAlerta } from "./lib/alertas.server";
import { DOMINIO_GESTAO, caminhoPermitidoNoDominioGestao } from "./lib/dominio-gestao";

// Health-check público pra monitor de uptime externo (UptimeRobot etc.) —
// responde antes de qualquer roteamento do TanStack Start, pra não depender
// de SSR/React estarem de pé. Ver docs/observabilidade-alertas.md.
function respostaHealth(): Response {
  return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  const erro = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(erro);
  void dispararAlerta("erro_servidor_critico", "Erro crítico no servidor (SSR)", {
    mensagem: erro instanceof Error ? erro.message : String(erro),
  });
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    // Área de gestão (/admin) mora em domínio à parte do produto — separa a
    // ferramenta interna do domínio voltado pra Aimer.
    if (
      url.pathname.startsWith("/admin") &&
      (url.hostname === "usepolia.com.br" || url.hostname === "www.usepolia.com.br")
    ) {
      url.hostname = DOMINIO_GESTAO;
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname === DOMINIO_GESTAO && url.pathname === "/") {
      url.pathname = "/central";
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname === DOMINIO_GESTAO && !caminhoPermitidoNoDominioGestao(url.pathname)) {
      url.hostname = "usepolia.com.br";
      return Response.redirect(url.toString(), 301);
    }
    if (url.hostname === "www.usepolia.com.br") {
      url.hostname = "usepolia.com.br";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/health") return respostaHealth();

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      void dispararAlerta("erro_servidor_critico", "Erro crítico no servidor (fetch handler)", {
        mensagem: error instanceof Error ? error.message : String(error),
      });
      return brandedErrorResponse();
    }
  },
};
