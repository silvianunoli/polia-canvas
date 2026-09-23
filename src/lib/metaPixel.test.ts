import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Mod = typeof import("./metaPixel");

let mod: Mod;

beforeEach(async () => {
  // ultimaPageViewPathname é estado de módulo; window.fbq é global.
  vi.resetModules();
  vi.stubEnv("VITE_META_PIXEL_ID", "123");
  document.head.innerHTML = "";
  delete window.fbq;
  delete window._fbq;
  mod = await import("./metaPixel");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("PIXEL_ID", () => {
  it("vem de VITE_META_PIXEL_ID", () => {
    expect(mod.PIXEL_ID).toBe("123");
  });
});

describe("carregarPixel", () => {
  it("cria o stub fbq, injeta o script e enfileira init + PageView", () => {
    mod.carregarPixel("123");

    expect(window.fbq).toBeDefined();
    expect(window._fbq).toBe(window.fbq);
    expect(window.fbq!.loaded).toBe(true);
    expect(window.fbq!.version).toBe("2.0");

    const script = document.head.querySelector<HTMLScriptElement>(
      'script[src="https://connect.facebook.net/en_US/fbevents.js"]',
    );
    expect(script).not.toBeNull();
    expect(script!.async).toBe(true);

    // enquanto o script não chega, as chamadas ficam na fila
    expect(window.fbq!.queue).toEqual([
      ["init", "123"],
      ["track", "PageView"],
    ]);
  });

  it("é idempotente: segunda chamada não injeta outro script nem repete init", () => {
    mod.carregarPixel("123");
    mod.carregarPixel("123");
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    expect(window.fbq!.queue.filter((c) => (c as unknown[])[0] === "init")).toHaveLength(1);
  });

  it("depois que o script carrega (callMethod existe), delega pra ele em vez da fila", () => {
    mod.carregarPixel("123");
    const callMethod = vi.fn();
    window.fbq!.callMethod = callMethod;
    window.fbq!("track", "Lead");
    expect(callMethod).toHaveBeenCalledWith("track", "Lead");
  });
});

describe("pixelPageView", () => {
  it("não faz nada sem o Pixel carregado (sem consentimento)", () => {
    expect(() => mod.pixelPageView("/planos")).not.toThrow();
    expect(window.fbq).toBeUndefined();
  });

  // O efeito de rota e o carregamento inicial podem cair na mesma página.
  it("deduplica PageView pro mesmo pathname e dispara de novo em rota nova", () => {
    mod.carregarPixel("123");
    const contarPageViews = () =>
      window.fbq!.queue.filter((c) => (c as unknown[])[1] === "PageView").length;

    expect(contarPageViews()).toBe(1);
    mod.pixelPageView("/");
    expect(contarPageViews()).toBe(1);
    mod.pixelPageView("/planos");
    expect(contarPageViews()).toBe(2);
    mod.pixelPageView("/planos");
    expect(contarPageViews()).toBe(2);
  });
});

describe("pixelLead", () => {
  it("não faz nada sem o Pixel carregado", () => {
    expect(() => mod.pixelLead("ev-1")).not.toThrow();
  });

  // Sem dado pessoal no payload: só o eventID, pra dedup com a API de Conversões.
  it("manda track Lead só com eventID", () => {
    mod.carregarPixel("123");
    mod.pixelLead("ev-1");
    expect(window.fbq!.queue.at(-1)).toEqual(["track", "Lead", {}, { eventID: "ev-1" }]);
  });
});

describe("sem window (SSR)", () => {
  it("nenhuma função explode", () => {
    vi.stubGlobal("window", undefined);
    expect(() => mod.carregarPixel("123")).not.toThrow();
    expect(() => mod.pixelPageView("/")).not.toThrow();
    expect(() => mod.pixelLead("x")).not.toThrow();
  });
});
