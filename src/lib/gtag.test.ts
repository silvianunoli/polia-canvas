import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Mod = typeof import("./gtag");

async function carregarModulo(measurementId?: string): Promise<Mod> {
  vi.resetModules();
  if (measurementId === undefined) vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
  else vi.stubEnv("VITE_GA_MEASUREMENT_ID", measurementId);
  return import("./gtag");
}

describe("gtag", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    delete window.dataLayer;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("MEASUREMENT_ID vem de VITE_GA_MEASUREMENT_ID", async () => {
    const mod = await carregarModulo("G-TESTE");
    expect(mod.MEASUREMENT_ID).toBe("G-TESTE");
  });

  describe("carregarGtag", () => {
    it("injeta o script do GA com o id e inicializa o dataLayer com js + config", async () => {
      const { carregarGtag } = await carregarModulo("G-TESTE");
      carregarGtag("G-TESTE");

      const script = document.head.querySelector<HTMLScriptElement>(
        'script[src*="googletagmanager.com/gtag/js"]',
      );
      expect(script).not.toBeNull();
      expect(script!.src).toContain("id=G-TESTE");
      expect(script!.async).toBe(true);

      expect(window.dataLayer).toHaveLength(2);
      const [js, config] = window.dataLayer as unknown[][];
      expect(js[0]).toBe("js");
      expect(js[1]).toBeInstanceOf(Date);
      expect(config).toEqual(["config", "G-TESTE"]);
    });

    // O efeito de consentimento pode chamar de novo ao mudar o banner.
    it("não injeta o script duas vezes", async () => {
      const { carregarGtag } = await carregarModulo("G-TESTE");
      carregarGtag("G-TESTE");
      carregarGtag("G-TESTE");
      expect(document.head.querySelectorAll('script[src*="gtag/js"]')).toHaveLength(1);
      expect(window.dataLayer).toHaveLength(2);
    });
  });

  describe("gtagEvent", () => {
    it("não faz nada quando o GA não carregou (sem consentimento)", async () => {
      const { gtagEvent } = await carregarModulo("G-TESTE");
      expect(() => gtagEvent("ativacao")).not.toThrow();
      expect(window.dataLayer).toBeUndefined();
    });

    it("empurra o evento no dataLayer quando o GA está carregado", async () => {
      const { carregarGtag, gtagEvent } = await carregarModulo("G-TESTE");
      carregarGtag("G-TESTE");
      gtagEvent("ativacao", { plano: "premium" });
      expect(window.dataLayer!.at(-1)).toEqual(["event", "ativacao", { plano: "premium" }]);
    });

    it("propriedades ausentes viram objeto vazio", async () => {
      const { gtagEvent } = await carregarModulo("G-TESTE");
      window.dataLayer = [];
      gtagEvent("x");
      expect(window.dataLayer[0]).toEqual(["event", "x", {}]);
    });

    it("não explode sem window (SSR)", async () => {
      const { gtagEvent } = await carregarModulo("G-TESTE");
      vi.stubGlobal("window", undefined);
      expect(() => gtagEvent("x")).not.toThrow();
    });
  });
});
