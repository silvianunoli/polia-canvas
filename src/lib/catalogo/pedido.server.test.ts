import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

import { responderPedidoCatalogo } from "./pedido.server";

const ORIGEM = "https://loveless-crochet.usepolia.workers.dev";
const pedido = {
  dominio: "lovelesscrochet.com.br",
  id: "6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f",
  itens: [{ nome: "Jenny", variacao: "cor 840 Preto", quantidade: 2, preco_unitario: 289 }],
  cliente: { nome: "Ana Souza", whatsapp: "11977435996" },
  entrega: { tipo: "Envio", endereco: "Avenida Paulista, 1000" },
  prazo_dias_uteis: 5,
};

function req(corpo: unknown, origem: string | null = ORIGEM, metodo = "POST") {
  const headers: Record<string, string> = { "content-type": "text/plain", "cf-connecting-ip": "203.0.113.7" };
  if (origem) headers.origin = origem;
  return new Request("https://one.usepolia.com.br/api/catalogo/pedido", {
    method: metodo,
    headers,
    body: metodo === "POST" ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) : undefined,
  });
}
const ler = async (r: Response) => (await r.json()) as { resultado: string };

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: "ok", error: null });
});

describe("POST /api/catalogo/pedido", () => {
  it("grava pela RPC com o WhatsApp normalizado e devolve a origem no CORS", async () => {
    const r = await responderPedidoCatalogo(req(pedido));
    expect(r.status).toBe(200);
    expect(await ler(r)).toEqual({ resultado: "ok" });
    expect(r.headers.get("access-control-allow-origin")).toBe(ORIGEM);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [nome, args] = rpc.mock.calls[0];
    expect(nome).toBe("registrar_pedido_catalogo");
    expect(args).toMatchObject({
      p_dominio: "lovelesscrochet.com.br",
      p_id_externo: pedido.id,
      p_whatsapp: "5511977435996",
      p_cliente_nome: "Ana Souza",
      p_prazo_dias_uteis: 5,
    });
    expect(args.p_observacao).toContain("Endereço: Avenida Paulista, 1000.");
    expect(args.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("recusa origem que não é a da loja, sem chamar o banco", async () => {
    const r = await responderPedidoCatalogo(req(pedido, "https://outraloja.com.br"));
    expect(r.status).toBe(403);
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa pedido sem origem (fora de navegador)", async () => {
    const r = await responderPedidoCatalogo(req(pedido, null));
    expect(r.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa JSON quebrado, campos errados e corpo grande", async () => {
    expect((await responderPedidoCatalogo(req("{nao é json"))).status).toBe(400);
    expect((await responderPedidoCatalogo(req({ ...pedido, itens: [] }))).status).toBe(400);
    expect((await responderPedidoCatalogo(req({ ...pedido, cliente: { nome: "A", whatsapp: "123" } }))).status).toBe(400);
    expect((await responderPedidoCatalogo(req("x".repeat(20_000)))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("campo-isca preenchido é recusado sem gravar", async () => {
    const r = await responderPedidoCatalogo(req({ ...pedido, site: "spam" }));
    expect(r.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduz o que o banco devolve", async () => {
    rpc.mockResolvedValueOnce({ data: "repetido", error: null });
    expect(await ler(await responderPedidoCatalogo(req(pedido)))).toEqual({ resultado: "repetido" });
    rpc.mockResolvedValueOnce({ data: "limite", error: null });
    expect((await responderPedidoCatalogo(req(pedido))).status).toBe(429);
    rpc.mockResolvedValueOnce({ data: "indisponivel", error: null });
    expect((await responderPedidoCatalogo(req(pedido))).status).toBe(404);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "falhou" } });
    expect((await responderPedidoCatalogo(req(pedido))).status).toBe(500);
  });

  it("responde o preflight e recusa GET", async () => {
    const pre = await responderPedidoCatalogo(req(null, ORIGEM, "OPTIONS"));
    expect(pre.status).toBe(204);
    expect((await responderPedidoCatalogo(req(null, ORIGEM, "GET"))).status).toBe(405);
  });
});
