// POST /api/catalogo/pedido (ONE-148, fase 1). Responde antes do TanStack, no
// src/server.ts, porque quem chama é o site do catálogo, de outro domínio, sem
// sessão. Fluxo: confere tamanho, JSON e campos (lib/catalogo.ts), confere que
// a origem é o domínio da loja, e grava pela registrar_pedido_catalogo (service
// role), que acha a loja, aplica o plano e os limites e é idempotente pelo id.
//
// O catálogo manda o corpo como text/plain pra ser "requisição simples" e não
// precisar de preflight. O CORS devolve a própria origem só quando ela bate com
// o domínio do pedido.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  montarObservacao,
  normalizarDominio,
  normalizarWhatsapp,
  origemPermitida,
  pedidoCatalogoSchema,
  type ResultadoPedidoCatalogo,
} from "@/lib/catalogo";

export const CAMINHO_PEDIDO_CATALOGO = "/api/catalogo/pedido";
const TETO_CORPO = 16_000;

function resposta(status: number, resultado: ResultadoPedidoCatalogo, origem: string | null): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", vary: "Origin" });
  if (origem) headers.set("access-control-allow-origin", origem);
  return new Response(JSON.stringify({ resultado }), { status, headers });
}

/** Hash do IP com o dia junto, igual à captura de leads: conta o limite por aparelho sem guardar o IP. */
async function hashDoAparelho(request: Request): Promise<string | null> {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return null;
  const dia = new Date().toISOString().slice(0, 10);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`catalogo|${dia}|${ip}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function responderPedidoCatalogo(request: Request): Promise<Response> {
  const origem = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    const headers = new Headers({ "access-control-allow-methods": "POST", "access-control-max-age": "86400", vary: "Origin" });
    if (origem?.startsWith("https://")) headers.set("access-control-allow-origin", origem);
    headers.set("access-control-allow-headers", "content-type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") return resposta(405, "invalido", null);

  const corpo = await request.text();
  if (corpo.length > TETO_CORPO) return resposta(413, "invalido", null);

  let bruto: unknown;
  try {
    bruto = JSON.parse(corpo);
  } catch {
    return resposta(400, "invalido", null);
  }
  const lido = pedidoCatalogoSchema.safeParse(bruto);
  if (!lido.success) return resposta(400, "invalido", null);
  const pedido = lido.data;

  const dominio = normalizarDominio(pedido.dominio);
  if (!dominio || !origemPermitida(origem, dominio)) return resposta(403, "indisponivel", null);
  // Daqui pra frente a origem é a da loja: pode ler a resposta.
  if (pedido.site) return resposta(200, "ok", origem);

  const whatsapp = normalizarWhatsapp(pedido.cliente.whatsapp);
  if (!whatsapp) return resposta(400, "invalido", origem);

  try {
    const { data, error } = await supabaseAdmin.rpc("registrar_pedido_catalogo" as never, {
      p_dominio: dominio,
      p_id_externo: pedido.id,
      p_itens: pedido.itens.map((i) => ({
        nome: i.nome,
        variacao: i.variacao ?? null,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      })),
      p_cliente_nome: pedido.cliente.nome,
      p_whatsapp: whatsapp,
      p_observacao: montarObservacao(pedido),
      p_prazo_dias_uteis: pedido.prazo_dias_uteis ?? 7,
      p_ip_hash: await hashDoAparelho(request),
    } as never);
    if (error) {
      console.error("registrar_pedido_catalogo", error.code, error.message);
      return resposta(error.code === "23514" ? 400 : 500, error.code === "23514" ? "invalido" : "erro", origem);
    }
    const r = String(data) as ResultadoPedidoCatalogo;
    if (r === "ok" || r === "repetido") return resposta(200, r, origem);
    if (r === "limite") return resposta(429, r, origem);
    return resposta(404, "indisponivel", origem);
  } catch (e) {
    console.error("registrar_pedido_catalogo", e instanceof Error ? e.message : String(e));
    return resposta(500, "erro", origem);
  }
}
