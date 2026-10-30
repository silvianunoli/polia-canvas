import { describe, it, expect } from "vitest";
import {
  ESCOPOS_TIKTOK,
  acessoPertoDeVencer,
  contaInstagramProfissional,
  escoposInstagramCompletos,
  escoposTiktokCompletos,
  fotoSegura,
  limparCodigoInstagram,
  perfilInstagramDaResposta,
  perfilTiktokDaResposta,
  precisaRenovarNoCron,
  tokenCurtoInstagram,
  tokenLongoInstagram,
  tokensTiktokDaResposta,
  urlAutorizacaoInstagram,
  urlAutorizacaoTiktok,
} from "../../supabase/functions/_shared/redesSociais.ts";

const AGORA = Date.parse("2026-10-30T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("autorização", () => {
  it("TikTok pede só os dois escopos usados, com state e redirect", () => {
    const url = new URL(
      urlAutorizacaoTiktok({
        clientKey: "ck",
        redirectUri: "https://one.usepolia.com.br/x",
        state: "st",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,video.publish");
    expect(url.searchParams.get("scope")).not.toContain("video.upload");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("redirect_uri")).toBe("https://one.usepolia.com.br/x");
    expect(url.searchParams.get("client_key")).toBe("ck");
  });

  it("Instagram pede publicar e força a escolha da conta", () => {
    const url = new URL(
      urlAutorizacaoInstagram({ appId: "1", redirectUri: "https://r", state: "s" }),
    );
    expect(url.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_content_publish",
    );
    expect(url.searchParams.get("force_authentication")).toBe("1");
    expect(url.searchParams.get("enable_fb_login")).toBe("0");
  });

  it("tira o #_ do code do Instagram", () => {
    expect(limparCodigoInstagram("AQBx#_")).toBe("AQBx");
    expect(limparCodigoInstagram("AQBx")).toBe("AQBx");
  });
});

describe("token do TikTok", () => {
  it("lê o par e calcula os prazos", () => {
    const t = tokensTiktokDaResposta(
      {
        access_token: "act",
        refresh_token: "rft",
        expires_in: 86400,
        refresh_expires_in: 31536000,
        open_id: "oid",
        scope: "user.info.basic,video.publish",
      },
      AGORA,
    );
    expect(t).toEqual({
      accessToken: "act",
      refreshToken: "rft",
      accessExpiraEm: iso(AGORA + DIA),
      refreshExpiraEm: iso(AGORA + 365 * DIA),
      openId: "oid",
      escopos: "user.info.basic,video.publish",
    });
  });

  it("erro com HTTP 200 é recusa", () => {
    expect(
      tokensTiktokDaResposta(
        { error: "invalid_grant", access_token: "x", refresh_token: "y", open_id: "z" },
        AGORA,
      ),
    ).toBeNull();
    expect(tokensTiktokDaResposta({ access_token: "x", open_id: "z" }, AGORA)).toBeNull();
    expect(tokensTiktokDaResposta(null, AGORA)).toBeNull();
  });

  it("prazo ausente cai no padrão do TikTok", () => {
    const t = tokensTiktokDaResposta(
      { access_token: "a", refresh_token: "r", open_id: "o" },
      AGORA,
    );
    expect(t?.accessExpiraEm).toBe(iso(AGORA + DIA));
  });

  it("autorização sem a permissão de publicar não serve", () => {
    expect(escoposTiktokCompletos(ESCOPOS_TIKTOK.join(","))).toBe(true);
    expect(escoposTiktokCompletos("user.info.basic")).toBe(false);
    expect(escoposTiktokCompletos("")).toBe(false);
  });
});

describe("token do Instagram", () => {
  it("lê o token curto no formato com data[] e no formato direto", () => {
    expect(
      tokenCurtoInstagram({
        data: [
          {
            access_token: "c",
            user_id: "123",
            permissions: "instagram_business_basic,instagram_business_content_publish",
          },
        ],
      }),
    ).toEqual({
      accessToken: "c",
      userId: "123",
      escopos: "instagram_business_basic,instagram_business_content_publish",
    });
    expect(
      tokenCurtoInstagram({
        access_token: "c",
        user_id: 99,
        permissions: ["instagram_business_basic"],
      }),
    ).toEqual({ accessToken: "c", userId: "99", escopos: "instagram_business_basic" });
    expect(tokenCurtoInstagram({ data: [] })).toBeNull();
  });

  it("token longo vale 60 dias", () => {
    expect(tokenLongoInstagram({ access_token: "l", expires_in: 5184000 }, AGORA)).toEqual({
      accessToken: "l",
      accessExpiraEm: iso(AGORA + 60 * DIA),
    });
    expect(tokenLongoInstagram({ error: { message: "x" } }, AGORA)).toBeNull();
  });

  it("escopos: só barra quando a lista veio e falta publicar", () => {
    expect(escoposInstagramCompletos("")).toBe(true);
    expect(escoposInstagramCompletos("instagram_business_basic")).toBe(false);
  });

  it("conta pessoal não publica", () => {
    expect(contaInstagramProfissional("BUSINESS")).toBe(true);
    expect(contaInstagramProfissional("MEDIA_CREATOR")).toBe(true);
    expect(contaInstagramProfissional("PERSONAL")).toBe(false);
    expect(contaInstagramProfissional(null)).toBe(true);
  });
});

describe("perfil", () => {
  it("TikTok junta /user/info e creator_info", () => {
    expect(
      perfilTiktokDaResposta(
        { data: { user: { open_id: "o", display_name: "Nome", avatar_url: "https://a" } } },
        {
          data: {
            creator_username: "hub.polia",
            creator_nickname: "Pólia",
            creator_avatar_url: "https://b",
          },
        },
      ),
    ).toEqual({ contaId: "o", usuario: "hub.polia", nome: "Pólia", fotoUrl: "https://b" });
  });

  it("sem resposta, tudo nulo (o nome é só rótulo)", () => {
    expect(perfilTiktokDaResposta(null, null)).toEqual({
      contaId: null,
      usuario: null,
      nome: null,
      fotoUrl: null,
    });
  });

  it("Instagram lê o tipo de conta", () => {
    expect(
      perfilInstagramDaResposta({ user_id: "1", username: "hub.polia", account_type: "BUSINESS" }),
    ).toMatchObject({ contaId: "1", usuario: "hub.polia", tipoConta: "BUSINESS" });
  });

  it("foto só https", () => {
    expect(fotoSegura("http://x")).toBeNull();
    expect(fotoSegura("javascript:alert(1)")).toBeNull();
    expect(fotoSegura("https://x/y.jpg")).toBe("https://x/y.jpg");
  });
});

describe("renovação", () => {
  it("Instagram renova a 20 dias do fim, nunca com menos de 24 h de vida", () => {
    const base = { rede: "instagram" as const, refreshExpiraEm: null };
    expect(
      precisaRenovarNoCron(
        { ...base, accessExpiraEm: iso(AGORA + 10 * DIA), renovadoEm: iso(AGORA - 50 * DIA) },
        AGORA,
      ),
    ).toBe(true);
    expect(
      precisaRenovarNoCron(
        { ...base, accessExpiraEm: iso(AGORA + 40 * DIA), renovadoEm: iso(AGORA - 20 * DIA) },
        AGORA,
      ),
    ).toBe(false);
    expect(
      precisaRenovarNoCron(
        { ...base, accessExpiraEm: iso(AGORA + 10 * DIA), renovadoEm: iso(AGORA - 2 * 3600_000) },
        AGORA,
      ),
    ).toBe(false);
    // Já venceu: a Meta não renova; só reconectando.
    expect(
      precisaRenovarNoCron(
        { ...base, accessExpiraEm: iso(AGORA - DIA), renovadoEm: iso(AGORA - 61 * DIA) },
        AGORA,
      ),
    ).toBe(false);
  });

  it("TikTok renova quando a renovação vence em até 30 dias", () => {
    const base = { rede: "tiktok" as const, accessExpiraEm: null, renovadoEm: null };
    expect(precisaRenovarNoCron({ ...base, refreshExpiraEm: iso(AGORA + 10 * DIA) }, AGORA)).toBe(
      true,
    );
    expect(precisaRenovarNoCron({ ...base, refreshExpiraEm: iso(AGORA + 200 * DIA) }, AGORA)).toBe(
      false,
    );
    expect(precisaRenovarNoCron({ ...base, refreshExpiraEm: null }, AGORA)).toBe(false);
  });

  it("acesso a menos de 5 minutos do fim, ou sem prazo, renova antes de usar", () => {
    expect(acessoPertoDeVencer(iso(AGORA + 60_000), AGORA)).toBe(true);
    expect(acessoPertoDeVencer(iso(AGORA + 3600_000), AGORA)).toBe(false);
    expect(acessoPertoDeVencer(null, AGORA)).toBe(true);
  });
});
