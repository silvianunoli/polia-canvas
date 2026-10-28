import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { estadoPush, rotaSegura } = await import("./push");

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
