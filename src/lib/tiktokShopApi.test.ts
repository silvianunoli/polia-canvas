import { afterEach, describe, expect, it, vi } from "vitest";
import { tiktokAbertoPara } from "./tiktokShopApi";

describe("tiktokAbertoPara (VND-42)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fechado: só as duas contas de teste", () => {
    vi.stubEnv("TIKTOK_SHOP_ABERTO", "");
    expect(tiktokAbertoPara("1aa18965-2aed-4c38-a827-f829b0c0f760")).toBe(true);
    expect(tiktokAbertoPara("05099e07-0501-46b3-86ac-8d884894f703")).toBe(true);
    expect(tiktokAbertoPara("uma-cliente-pro")).toBe(false);
  });

  it("TIKTOK_SHOP_ABERTO=1 abre para todas", () => {
    vi.stubEnv("TIKTOK_SHOP_ABERTO", "1");
    expect(tiktokAbertoPara("uma-cliente-pro")).toBe(true);
  });
});
