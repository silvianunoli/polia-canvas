import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { from, insert } = vi.hoisted(() => {
  const insert = vi.fn((..._args: unknown[]) => Promise.resolve({ error: null }));
  return { insert, from: vi.fn(() => ({ insert })) };
});
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

// Tudo aqui passa por emSegundoPlano (waitUntil no Worker). Espiona só pra
// provar que a escrita foi entregue à fila, sem depender do AsyncLocalStorage.
const { emSegundoPlano } = vi.hoisted(() => ({ emSegundoPlano: vi.fn() }));
vi.mock("@/lib/segundo-plano.server", () => ({ emSegundoPlano }));

import {
  registrarEventoServidor,
  registrarEventoSistema,
  registrarChamadaApi,
  subDoBearer,
} from "./founder-eventos.server";

beforeEach(() => {
  from.mockClear();
  insert.mockClear();
  emSegundoPlano.mockReset();
  delete process.env.FOUNDER_AMBIENTE;
});

afterEach(() => {
  delete process.env.FOUNDER_AMBIENTE;
});

describe("registrarEventoServidor", () => {
  it("grava em founder_eventos com origem server, sessão nova e ambiente prod por padrão", () => {
    registrarEventoServidor({ evento: "compra_concluida", userId: "u-1", feature: "checkout" });
    expect(from).toHaveBeenCalledWith("founder_eventos");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u-1",
        evento: "compra_concluida",
        feature: "checkout",
        pagina: null,
        ambiente: "prod",
        origem: "server",
        propriedades: {},
      }),
    );
    const linha = insert.mock.calls[0][0] as { sessao_id: string };
    expect(linha.sessao_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(emSegundoPlano).toHaveBeenCalledTimes(1);
  });

  it("FOUNDER_AMBIENTE preview/dev muda o ambiente; qualquer outro valor cai em prod", () => {
    process.env.FOUNDER_AMBIENTE = "preview";
    registrarEventoServidor({ evento: "x", userId: null });
    process.env.FOUNDER_AMBIENTE = "dev";
    registrarEventoServidor({ evento: "x", userId: null });
    process.env.FOUNDER_AMBIENTE = "staging";
    registrarEventoServidor({ evento: "x", userId: null });
    const ambientes = insert.mock.calls.map((c) => (c[0] as { ambiente: string }).ambiente);
    expect(ambientes).toEqual(["preview", "dev", "prod"]);
  });
});

describe("registrarEventoSistema", () => {
  it("grava em founder_eventos_sistema com defaults nulos", () => {
    registrarEventoSistema({ tipo: "ia_failure", origem: "gemini" });
    expect(from).toHaveBeenCalledWith("founder_eventos_sistema");
    expect(insert).toHaveBeenCalledWith({
      tipo: "ia_failure",
      origem: "gemini",
      servico: null,
      detalhes: {},
      latencia_ms: null,
    });
  });

  it("repassa serviço, detalhes e latência quando informados", () => {
    registrarEventoSistema({
      tipo: "latency",
      origem: "start.ts",
      servico: "serverFn",
      detalhes: { fn: "x" },
      latenciaMs: 120,
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ servico: "serverFn", detalhes: { fn: "x" }, latencia_ms: 120 }),
    );
  });
});

describe("registrarChamadaApi", () => {
  it("corta o nome da fn em 200 caracteres (coluna limitada)", () => {
    registrarChamadaApi({
      fn: "a".repeat(300),
      tipo: "server_fn",
      ok: true,
      latenciaMs: 5,
    });
    expect(from).toHaveBeenCalledWith("founder_api_chamadas");
    const linha = insert.mock.calls[0][0] as Record<string, unknown>;
    expect((linha.fn as string).length).toBe(200);
    expect(linha).toEqual(
      expect.objectContaining({
        tipo: "server_fn",
        metodo: null,
        ok: true,
        status: null,
        latencia_ms: 5,
        user_id: null,
      }),
    );
  });
});

describe("subDoBearer", () => {
  function jwt(payload: unknown): string {
    const b64url = (s: string) =>
      btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(payload))}.assinatura`;
  }

  it("extrai o sub de um JWT base64url sem validar assinatura", () => {
    // Payload com caracteres que geram + e / no base64 clássico.
    expect(subDoBearer(`Bearer ${jwt({ sub: "u-1", nome: "Ana >> ?? ~~" })}`)).toBe("u-1");
  });

  it("devolve null sem Bearer, com token malformado, ou sem sub string", () => {
    expect(subDoBearer(null)).toBeNull();
    expect(subDoBearer("Basic abc")).toBeNull();
    expect(subDoBearer("Bearer so.duas")).toBeNull();
    expect(subDoBearer("Bearer a.###.c")).toBeNull();
    expect(subDoBearer(`Bearer ${jwt({ sub: 42 })}`)).toBeNull();
    expect(subDoBearer(`Bearer ${jwt({})}`)).toBeNull();
  });
});
