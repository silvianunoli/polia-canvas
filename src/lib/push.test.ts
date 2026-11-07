import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { ESPERA_CONVITE_PUSH_MS, deveConvidarPush, estadoPush, precisaConvitePush, rotaSegura } =
  await import("./push");

describe("deveConvidarPush (ONE-188)", () => {
  const agora = 1_800_000_000_000;

  it("convida só com a permissão do Android ainda não decidida", () => {
    expect(deveConvidarPush("pendente", null, null, agora)).toBe(true);
    expect(deveConvidarPush("ativo", null, null, agora)).toBe(false);
    expect(deveConvidarPush("negado", null, null, agora)).toBe(false);
    expect(deveConvidarPush("indisponivel", null, null, agora)).toBe(false);
  });

  it("depois do pedido do Android, não convida de novo", () => {
    expect(deveConvidarPush("pendente", "1", null, agora)).toBe(false);
  });

  it("'Agora não' segura o convite por 7 dias", () => {
    const ontem = String(agora - 24 * 60 * 60 * 1000);
    const haOitoDias = String(agora - ESPERA_CONVITE_PUSH_MS - 1000);
    expect(deveConvidarPush("pendente", null, ontem, agora)).toBe(false);
    expect(deveConvidarPush("pendente", null, haOitoDias, agora)).toBe(true);
    expect(deveConvidarPush("pendente", null, "lixo", agora)).toBe(true);
  });

  it("fora do app Android nunca convida", async () => {
    expect(await precisaConvitePush()).toBe(false);
  });
});

describe("rotaSegura", () => {
  it("aceita rota interna do aviso", () => {
    expect(rotaSegura("/vendas")).toBe("/vendas");
    expect(rotaSegura("/painel")).toBe("/painel");
    expect(rotaSegura("/produtos/anuncios")).toBe("/produtos/anuncios");
  });

  it("recusa URL de fora, protocolo e lixo", () => {
    expect(rotaSegura("https://golpe.com")).toBeNull();
    expect(rotaSegura("//golpe.com")).toBeNull();
    expect(rotaSegura("javascript:alert(1)")).toBeNull();
    expect(rotaSegura("/vendas?x=<script>")).toBeNull();
    expect(rotaSegura(undefined)).toBeNull();
    expect(rotaSegura(42)).toBeNull();
  });
});

describe("estadoPush", () => {
  it("fora do app Android não faz nada", async () => {
    expect(await estadoPush()).toBe("indisponivel");
  });
});
