import { describe, it, expect, afterEach, vi } from "vitest";

const { isNativePlatformMock } = vi.hoisted(() => ({ isNativePlatformMock: vi.fn() }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));

const { isNativeApp } = await import("./platform");

describe("isNativeApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("repassa a resposta do Capacitor no browser", () => {
    isNativePlatformMock.mockReturnValue(true);
    expect(isNativeApp()).toBe(true);
    isNativePlatformMock.mockReturnValue(false);
    expect(isNativeApp()).toBe(false);
  });

  // O servidor nunca sabe que é o app: SSR sempre assume web.
  it("devolve false sem window (SSR), sem nem consultar o Capacitor", () => {
    vi.stubGlobal("window", undefined);
    expect(isNativeApp()).toBe(false);
    expect(isNativePlatformMock).not.toHaveBeenCalled();
  });
});
