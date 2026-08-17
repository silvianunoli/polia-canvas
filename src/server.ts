import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { dispararAlerta } from "./lib/alertas.server";
import { DOMINIO_GESTAO } from "./lib/dominio-gestao";
import { CORPO_ROBOTS } from "./lib/robots";
import { deveRedirecionarParaHostCanonico, HOSTNAME_CANONICO } from "./lib/seo";
import { montarSitemap, type PostSitemap } from "./lib/sitemap";
import { supabase } from "./integrations/supabase/client";

// Health-check público pra monitor de uptime externo (UptimeRobot etc.) —
// responde antes de qualquer roteamento do TanStack Start, pra não depender
// de SSR/React estarem de pé. Ver docs/observabilidade-alertas.md.
function respostaHealth(): Response {
  return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// Sitemap e robots.txt respondem antes do roteamento do TanStack Start, no
// mesmo padrão do /health: são texto puro, não precisam de SSR nem de React de
// pé, e um erro de renderização não pode derrubar a descoberta do site.
async function respostaSitemap(): Promise<Response> {
  let posts: PostSitemap[] = [];
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug, publicado_em")
      .eq("publicado", true)
      .order("publicado_em", { ascending: false });
    if (error) throw error;
    posts = (data as PostSitemap[] | null) ?? [];
  } catch (erro) {
    // Sitemap parcial (só as estáticas) é melhor que 500: um sitemap que
    // responde erro o Google descarta inteiro, junto com as URLs que já
    // estavam certas.
    console.error("[sitemap] falha ao buscar blog_posts:", erro);
  }

  return new Response(montarSitemap(posts), {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

function respostaRobots(): Response {
  return new Response(CORPO_ROBOTS, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
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
    // Área de gestão (/admin) mora em deploy e domínio à parte do produto
    // desde 27/07/2026 (projeto polia-admin/, Worker "polia-admin") — separa
    // a ferramenta interna do domínio voltado pra Aimer. O app novo não tem
    // mais o prefixo /admin nas rotas (ex.: /admin/crm virou /crm), então o
    // redirect precisa tirar esse prefixo, não só trocar o hostname.
    if (
      (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) &&
      (url.hostname === "usepolia.com.br" || url.hostname === "www.usepolia.com.br")
    ) {
      url.hostname = DOMINIO_GESTAO;
      url.pathname = url.pathname.slice("/admin".length) || "/";
      return Response.redirect(url.toString(), 301);
    }
    // /health responde em QUALQUER hostname e vem antes do 301: o monitor
    // externo de uptime bate no fallback workers.dev, e um redirect quebraria
    // o check.
    if (url.pathname === "/health") return respostaHealth();

    // Qualquer hostname que não seja o oficial (www, workers.dev, preview de
    // deploy) leva 301 pro domínio próprio. O workers_dev segue ligado no
    // wrangler.jsonc de propósito, como fallback operacional; é este 301 que
    // impede o mesmo conteúdo de entrar no índice do Google em dois endereços.
    if (deveRedirecionarParaHostCanonico(url.hostname)) {
      url.protocol = "https:";
      url.hostname = HOSTNAME_CANONICO;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/sitemap.xml") return await respostaSitemap();
    if (url.pathname === "/robots.txt") return respostaRobots();

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
