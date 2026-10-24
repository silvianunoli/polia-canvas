import { createHash } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type Mod = typeof import("./tiktokPixel");

let mod: Mod;

beforeEach(async () => {
  // Dedups e o ViewContent pendente são estado de módulo; window.ttq é global.
  vi.resetModules();
  document.head.innerHTML = "";
  delete window.ttq;
  delete window.TiktokAnalyticsObject;
  mod = await import("./tiktokPixel");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const fila = () => Array.from(window.ttq as unknown as unknown[]) as unknown[][];
const ultimo = () => fila().at(-1);
// Os eventos esperam o hash do identify (assíncrono) antes de sair: espera o
// evento chegar na fila, sem depender de quanto o hash demora na máquina.
const chegou = (evento: string) =>
  vi.waitFor(() => {
    if (!fila().some((c) => c[0] === "track" && c[1] === evento)) throw new Error(evento);
  });
const esperar = () => new Promise((r) => setTimeout(r, 50));

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
    expect(fila().filter((c) => c[0] === "page")).toHaveLength(2);
  });

  it("volta de autorização com ?code= não manda page (a URL levaria o code)", () => {
    window.history.replaceState(null, "", "/configuracoes/integracoes/tiktok?code=abc&state=x");
    try {
      mod.carregarTiktokPixel("ABC");
      mod.tiktokPageView(window.location.pathname);
      expect(fila().filter((c) => c[0] === "page")).toHaveLength(0);
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });
});

describe("tiktokViewContent", () => {
  it("landing conhecida sai com nome legível", () => {
    mod.carregarTiktokPixel("ABC");
    mod.tiktokViewContent("/premium-a");
    expect(ultimo()).toEqual([
      "track",
      "ViewContent",
      {
        contents: [
          { content_id: "/premium-a", content_type: "product", content_name: "Landing Premium A" },
        ],
      },
    ]);
  });

  it("landing nova, sem cadastro em lista nenhuma, também sai", () => {
    mod.carregarTiktokPixel("ABC");
    mod.tiktokViewContent("/landing-c/");
    expect(ultimo()?.[2]).toEqual({
      contents: [{ content_id: "/landing-c", content_type: "product", content_name: "/landing-c" }],
    });
  });

  it("cadastro, páginas legais e pós-compra ficam de fora", () => {
    mod.carregarTiktokPixel("ABC");
    for (const p of [
      "/auth/cadastro",
      "/auth/login",
      "/privacidade",
      "/termos",
      "/compra-confirmada",
    ])
      mod.tiktokViewContent(p);
    expect(fila().filter((c) => c[1] === "ViewContent")).toHaveLength(0);
  });

  it("não repete na mesma página", () => {
    mod.carregarTiktokPixel("ABC");
    mod.tiktokViewContent("/landing-a");
    mod.tiktokViewContent("/landing-a");
    expect(fila().filter((c) => c[1] === "ViewContent")).toHaveLength(1);
  });

  it("página vista antes do aceite de cookies sai quando o pixel carrega", () => {
    mod.tiktokViewContent("/landing-b");
    expect(window.ttq).toBeUndefined();
    mod.carregarTiktokPixel("ABC");
    expect(ultimo()?.[1]).toBe("ViewContent");
    expect((ultimo()?.[2] as { contents: { content_id: string }[] }).contents[0].content_id).toBe(
      "/landing-b",
    );
  });
});

describe("tiktokCliqueEmLink", () => {
  beforeEach(() => mod.carregarTiktokPixel("ABC"));

  it("link pro cadastro vira ClickButton, sem value (0 o TikTok recusa)", async () => {
    mod.tiktokCliqueEmLink("/auth/cadastro?origem=landing-a");
    await chegou("ClickButton");
    expect(ultimo()?.[1]).toBe("ClickButton");
    expect(ultimo()?.[2]).not.toHaveProperty("value");
  });

  it("link pro /planos com plano vira AddToCart com valor", async () => {
    mod.tiktokCliqueEmLink("/planos?plano=premium#pagamento");
    await chegou("AddToCart");
    expect(ultimo()).toEqual([
      "track",
      "AddToCart",
      {
        contents: [
          {
            content_id: "controle_mensal",
            content_type: "product",
            content_name: "Pólia One Premium mensal",
          },
        ],
        value: 29.9,
        currency: "BRL",
      },
    ]);
  });

  it("link externo ou sem plano não dispara nada", async () => {
    mod.tiktokCliqueEmLink("https://instagram.com/hub.polia");
    mod.tiktokCliqueEmLink("/planos");
    mod.tiktokCliqueEmLink("/blog");
    await esperar();
    expect(fila()).toEqual([["page"]]);
  });
});

describe("identify", () => {
  beforeEach(() => mod.carregarTiktokPixel("ABC"));

  it("manda só hash SHA-256, antes do evento", async () => {
    mod.tiktokCadastro("email", "cadastro_1", { email: " Ana@Email.com ", userId: "u1" });
    await chegou("CompleteRegistration");
    const [identify, evento] = fila().slice(-2);
    expect(identify[0]).toBe("identify");
    const dados = identify[1] as Record<string, string>;
    // E-mail normalizado (sem espaço, minúsculo) antes do hash.
    expect(dados.email).toBe(createHash("sha256").update("ana@email.com").digest("hex"));
    expect(dados.external_id).toBe(createHash("sha256").update("u1").digest("hex"));
    expect(JSON.stringify(dados)).not.toContain("ana@");
    expect(evento).toEqual([
      "track",
      "CompleteRegistration",
      {
        contents: [
          { content_id: "gratis", content_type: "product", content_name: "Pólia One Grátis" },
        ],
        description: "email",
      },
      { event_id: "cadastro_1" },
    ]);
  });

  it("telefone vira E.164 do Brasil", () => {
    expect(mod.telefoneE164("(11) 98765-4321")).toBe("+5511987654321");
    expect(mod.telefoneE164("+55 11 98765-4321")).toBe("+5511987654321");
    expect(mod.telefoneE164("123")).toBeNull();
  });

  it("sem dado de quem, sai o evento sem identify", async () => {
    mod.tiktokLead("ev-1");
    await chegou("Lead");
    expect(fila().some((c) => c[0] === "identify")).toBe(false);
    expect(ultimo()).toEqual([
      "track",
      "Lead",
      { contents: [{ content_id: "manual", content_type: "product", content_name: "manual" }] },
      { event_id: "ev-1" },
    ]);
  });
});

describe("checkout e compra", () => {
  beforeEach(() => mod.carregarTiktokPixel("ABC"));

  it("InitiateCheckout leva plano e valor", async () => {
    mod.tiktokIniciouCheckout("projete_anual");
    await chegou("InitiateCheckout");
    expect(ultimo()?.[1]).toBe("InitiateCheckout");
    expect((ultimo()?.[2] as { currency: string }).currency).toBe("BRL");
  });

  it("Purchase em BRL com o event_id da compra", async () => {
    mod.tiktokCompra(29.9, "controle_mensal", "cs_1");
    await chegou("Purchase");
    expect(ultimo()).toEqual([
      "track",
      "Purchase",
      {
        contents: [
          {
            content_id: "controle_mensal",
            content_type: "product",
            content_name: "Pólia One Premium mensal",
          },
        ],
        value: 29.9,
        currency: "BRL",
      },
      { event_id: "cs_1" },
    ]);
  });
});
