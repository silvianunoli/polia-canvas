import { describe, expect, it } from "vitest";
import { emailJaTemConta } from "./signup";

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
