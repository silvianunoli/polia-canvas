import { describe, expect, it } from "vitest";
import {
  MSG_LOGIN_LIMITE,
  MSG_LOGIN_REDE,
  classificarErroLogin,
  ehErroDeRede,
  emailJaTemConta,
  sessaoEhDoEmail,
} from "./signup";

describe("emailJaTemConta", () => {
  it("reconhece o user falso com identities vazio (e-mail repetido, sem erro)", () => {
    expect(emailJaTemConta({ user: { identities: [] } }, null)).toBe(true);
  });

  it("cadastro novo tem uma identity e segue normal", () => {
    expect(emailJaTemConta({ user: { identities: [{ provider: "email" }] } }, null)).toBe(false);
  });

  it("não confunde ausência do campo identities com conta repetida", () => {
    expect(emailJaTemConta({ user: {} }, null)).toBe(false);
    expect(emailJaTemConta({ user: { identities: null } }, null)).toBe(false);
    expect(emailJaTemConta({ user: null }, null)).toBe(false);
  });

  it("reconhece a mensagem de erro de e-mail já registrado", () => {
    expect(emailJaTemConta(null, { message: "User already registered" })).toBe(true);
  });

  it("outro erro não é conta repetida", () => {
    expect(emailJaTemConta(null, { message: "Signup requires a valid password" })).toBe(false);
  });
});

describe("classificarErroLogin", () => {
  it("senha errada conta como credenciais", () => {
    expect(
      classificarErroLogin({
        code: "invalid_credentials",
        message: "Invalid login credentials",
        status: 400,
      }),
    ).toBe("credenciais");
  });

  it("falha de rede (AuthRetryableFetchError, status 0, 5xx) não é senha errada", () => {
    expect(
      classificarErroLogin({
        name: "AuthRetryableFetchError",
        message: "Failed to fetch",
        status: 0,
      }),
    ).toBe("rede");
    expect(classificarErroLogin({ message: "TypeError: Failed to fetch" })).toBe("rede");
    expect(classificarErroLogin({ message: "Bad gateway", status: 502 })).toBe("rede");
  });

  it("429 e over_request_rate_limit são limite do servidor", () => {
    expect(classificarErroLogin({ message: "Too many requests", status: 429 })).toBe("limite");
    expect(
      classificarErroLogin({ code: "over_request_rate_limit", message: "x", status: 400 }),
    ).toBe("limite");
  });

  it("e-mail não confirmado pelo code ou pela mensagem", () => {
    expect(classificarErroLogin({ code: "email_not_confirmed", message: "x" })).toBe(
      "email_nao_confirmado",
    );
    expect(classificarErroLogin({ message: "Email not confirmed", status: 400 })).toBe(
      "email_nao_confirmado",
    );
  });

  it("captcha vem antes de tudo", () => {
    expect(classificarErroLogin({ code: "captcha_failed", message: "captcha", status: 400 })).toBe(
      "captcha",
    );
  });
});

describe("ehErroDeRede", () => {
  it("erro de credencial não é rede", () => {
    expect(ehErroDeRede({ message: "Invalid login credentials", status: 400 })).toBe(false);
    expect(ehErroDeRede(null)).toBe(false);
  });
});

describe("sessaoEhDoEmail", () => {
  it("bate sem diferenciar caixa nem espaço", () => {
    expect(sessaoEhDoEmail("Ana@Marca.com", " ana@marca.com ")).toBe(true);
  });

  it("sessão de outra pessoa não bate", () => {
    expect(sessaoEhDoEmail("a@marca.com", "b@marca.com")).toBe(false);
  });

  it("sem um dos dois e-mails, não bate (na dúvida, não navega)", () => {
    expect(sessaoEhDoEmail(undefined, "b@marca.com")).toBe(false);
    expect(sessaoEhDoEmail("a@marca.com", undefined)).toBe(false);
    expect(sessaoEhDoEmail("", "")).toBe(false);
  });
});

describe("mensagens de login", () => {
  it("começam com maiúscula e não usam exclamação nem travessão", () => {
    for (const m of [MSG_LOGIN_REDE, MSG_LOGIN_LIMITE]) {
      expect(m).toMatch(/^[A-Z]/);
      expect(m).not.toMatch(/[!—–]/);
    }
  });
});
