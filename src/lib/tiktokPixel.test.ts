import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Mod = typeof import("./tiktokPixel");

let mod: Mod;

beforeEach(async () => {
  // ultimaPagePathname é estado de módulo; window.ttq é global.
  vi.resetModules();
  document.head.innerHTML = "";
  delete window.ttq;
  delete window.TiktokAnalyticsObject;
  mod = await import("./tiktokPixel");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const fila = () => Array.from(window.ttq as unknown as unknown[]);

describe("TIKTOK_PIXEL_ID", () => {
  it("usa o pixel da Pólia quando a variável não existe", () => {
    expect(mod.TIKTOK_PIXEL_ID).toBe("DB8M643C77UDN3PKVNQG");
  });
});

describe("carregarTiktokPixel", () => {
  it("cria a fila ttq, injeta o script e enfileira o page", () => {
    mod.carregarTiktokPixel("ABC");
    expect(window.TiktokAnalyticsObject).toBe("ttq");
    const script = document.head.querySelector("script");
    expect(script?.getAttribute("src")).toBe(
      "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=ABC&lib=ttq",
    );
    expect(script?.async).toBe(true);
    expect(fila()).toEqual([["page"]]);
  });

  it("não carrega duas vezes", () => {
    mod.carregarTiktokPixel("ABC");
    mod.carregarTiktokPixel("ABC");
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
  });
});

describe("tiktokPageView", () => {
  it("não faz nada sem o pixel carregado", () => {
    mod.tiktokPageView("/x");
    expect(window.ttq).toBeUndefined();
  });

  it("não repete o page no mesmo pathname", () => {
    mod.carregarTiktokPixel("ABC");
    mod.tiktokPageView(window.location.pathname);
    mod.tiktokPageView("/planos");
    mod.tiktokPageView("/planos");
    expect(fila().filter((c) => (c as unknown[])[0] === "page")).toHaveLength(2);
  });
});

describe("eventos", () => {
  beforeEach(() => mod.carregarTiktokPixel("ABC"));

  it("Lead leva o event_id", () => {
    mod.tiktokLead("ev-1");
    expect(fila().at(-1)).toEqual(["track", "Lead", {}, { event_id: "ev-1" }]);
  });

  it("CompleteRegistration com e sem event_id", () => {
    mod.tiktokCadastro("google", "cadastro_1");
    expect(fila().at(-1)).toEqual([
      "track",
      "CompleteRegistration",
      { content_name: "google" },
      { event_id: "cadastro_1" },
    ]);
    mod.tiktokCadastro("email");
    expect(fila().at(-1)).toEqual(["track", "CompleteRegistration", { content_name: "email" }]);
  });

  it("Purchase em BRL", () => {
    mod.tiktokCompra(29.9, "controle_mensal", "cs_1");
    expect(fila().at(-1)).toEqual([
      "track",
      "Purchase",
      {
        value: 29.9,
        currency: "BRL",
        content_id: "controle_mensal",
        content_name: "controle_mensal",
      },
      { event_id: "cs_1" },
    ]);
  });
});
