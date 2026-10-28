import { describe, expect, it } from "vitest";

import {
  caminhoSeguro,
  destinoPadraoDoLink,
  ehTipoDeLink,
  lerRetornoDoApp,
  tipoDoLinkExpirado,
  URL_RETORNO_GOOGLE,
} from "./linkDoApp";

describe("lerRetornoDoApp: volta do Google pelo esquema do app", () => {
  it("lê a sessão do hash", () => {
    expect(
      lerRetornoDoApp(`${URL_RETORNO_GOOGLE}#access_token=AAA&refresh_token=RRR&expires_in=3600`),
    ).toEqual({ tipo: "sessao", accessToken: "AAA", refreshToken: "RRR" });
  });

  it("desistir no Google vira cancelado; outro erro vira erro", () => {
    expect(lerRetornoDoApp(`${URL_RETORNO_GOOGLE}#error=access_denied`)).toEqual({
      tipo: "cancelado",
    });
    expect(
      lerRetornoDoApp(`${URL_RETORNO_GOOGLE}?error=server_error&error_description=Falhou`),
    ).toEqual({ tipo: "erro", mensagem: "Falhou" });
  });

  it("sem tokens é erro; outro caminho do esquema é ignorado", () => {
    expect(lerRetornoDoApp(`${URL_RETORNO_GOOGLE}#foo=1`).tipo).toBe("erro");
    expect(lerRetornoDoApp("br.com.usepolia.app://outra-coisa#access_token=A").tipo).toBe(
      "ignorar",
    );
  });
});

describe("lerRetornoDoApp: App Links do nosso domínio", () => {
  it("link do e-mail vira o caminho pra WebView", () => {
    expect(
      lerRetornoDoApp("https://one.usepolia.com.br/auth/link?token_hash=abc&type=signup"),
    ).toEqual({ tipo: "caminho", caminho: "/auth/link?token_hash=abc&type=signup" });
  });

  it("outro domínio, http e lixo são ignorados", () => {
    expect(lerRetornoDoApp("https://evil.com/auth/link").tipo).toBe("ignorar");
    expect(lerRetornoDoApp("http://one.usepolia.com.br/painel").tipo).toBe("ignorar");
    expect(lerRetornoDoApp("isso não é url").tipo).toBe("ignorar");
  });
});

describe("links de e-mail", () => {
  it("caminho seguro só aceita caminho interno", () => {
    expect(caminhoSeguro("/painel")).toBe("/painel");
    expect(caminhoSeguro("//evil.com")).toBeNull();
    expect(caminhoSeguro("https://evil.com")).toBeNull();
    expect(caminhoSeguro(null)).toBeNull();
  });

  it("tipos aceitos e destino padrão de cada um", () => {
    expect(ehTipoDeLink("signup")).toBe(true);
    expect(ehTipoDeLink("sms")).toBe(false);
    expect(destinoPadraoDoLink("signup")).toBe("/painel");
    expect(destinoPadraoDoLink("magiclink")).toBe("/painel");
    expect(destinoPadraoDoLink("invite")).toBe("/auth/criar-senha");
    expect(destinoPadraoDoLink("recovery")).toBe("/auth/redefinir-senha");
    expect(destinoPadraoDoLink("email_change")).toBe("/configuracoes");
  });

  it("tela de link vencido certa pra cada caso", () => {
    expect(tipoDoLinkExpirado("recovery", "/auth/redefinir-senha")).toBe("redefinicao");
    expect(tipoDoLinkExpirado("invite", "/auth/criar-senha")).toBe("convite");
    // Magiclink de ativação de compra leva pra criar senha.
    expect(tipoDoLinkExpirado("magiclink", "/auth/criar-senha")).toBe("convite");
    expect(tipoDoLinkExpirado("signup", "/painel")).toBe("confirmacao");
  });
});
