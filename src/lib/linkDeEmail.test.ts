import { describe, expect, it } from "vitest";

import { linkDeEmailPelaPolia } from "../../supabase/functions/_shared/linkDeEmail.ts";

describe("linkDeEmailPelaPolia (AND-09)", () => {
  it("monta o link no nosso domínio com token, tipo e destino", () => {
    const url = new URL(
      linkDeEmailPelaPolia(
        { hashed_token: "abc123", verification_type: "magiclink", action_link: "https://x" },
        "/auth/criar-senha",
      )!,
    );
    expect(url.origin).toBe("https://one.usepolia.com.br");
    expect(url.pathname).toBe("/auth/link");
    expect(url.searchParams.get("token_hash")).toBe("abc123");
    expect(url.searchParams.get("type")).toBe("magiclink");
    expect(url.searchParams.get("next")).toBe("/auth/criar-senha");
  });

  it("destino externo não entra no link", () => {
    const url = new URL(
      linkDeEmailPelaPolia({ hashed_token: "t", verification_type: "invite" }, "//evil.com")!,
    );
    expect(url.searchParams.has("next")).toBe(false);
  });

  it("sem token ou com tipo desconhecido, cai no action_link de sempre", () => {
    expect(linkDeEmailPelaPolia({ action_link: "https://supa/verify" }, "/painel")).toBe(
      "https://supa/verify",
    );
    expect(
      linkDeEmailPelaPolia(
        { hashed_token: "t", verification_type: "sms", action_link: "https://supa/verify" },
        "/painel",
      ),
    ).toBe("https://supa/verify");
    expect(linkDeEmailPelaPolia(null, "/painel")).toBeNull();
  });
});
