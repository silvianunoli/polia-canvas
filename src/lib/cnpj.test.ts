import { describe, expect, it } from "vitest";
import { cnpjValido, formatarCnpj } from "./cnpj";

describe("cnpjValido", () => {
  it("aceita CNPJ com os dígitos verificadores certos, com ou sem máscara", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("recusa o que não é CNPJ (o '123' do teste de 08/10)", () => {
    expect(cnpjValido("123")).toBe(false);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(cnpjValido("")).toBe(false);
  });
});

describe("formatarCnpj", () => {
  it("põe a máscara quando tem 14 dígitos", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("deixa como está o que não tem 14 dígitos", () => {
    expect(formatarCnpj("123")).toBe("123");
  });
});
