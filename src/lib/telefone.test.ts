import { describe, it, expect } from "vitest";
import { normalizarTelefone, mascararTelefone } from "./telefone";

describe("normalizarTelefone", () => {
  it("aceita o que a pessoa digita de verdade", () => {
    expect(normalizarTelefone("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizarTelefone("11999998888")).toBe("5511999998888");
    expect(normalizarTelefone("+55 11 99999-8888")).toBe("5511999998888");
    expect(normalizarTelefone("55 11 9999-8888")).toBe("551199998888");
    // Fixo com DDD, sem o 9: continua válido.
    expect(normalizarTelefone("(11) 3333-4444")).toBe("551133334444");
  });

  it("devolve nulo em vez de barrar quando o número não dá pra usar", () => {
    // O campo é opcional: número quebrado não pode custar a lead.
    expect(normalizarTelefone("")).toBeNull();
    expect(normalizarTelefone(null)).toBeNull();
    expect(normalizarTelefone("99999")).toBeNull();
    expect(normalizarTelefone("999998888")).toBeNull(); // sem DDD
    expect(normalizarTelefone("5511999998888123")).toBeNull(); // dígito demais
    expect(normalizarTelefone("não tenho")).toBeNull();
  });

  it("não duplica o 55 de quem já digitou o país", () => {
    expect(normalizarTelefone("5511999998888")).toBe("5511999998888");
    expect(normalizarTelefone("5511999998888")).not.toContain("5555");
  });
});

describe("mascararTelefone", () => {
  it("formata enquanto a pessoa digita, sem travar", () => {
    expect(mascararTelefone("1")).toBe("(1");
    expect(mascararTelefone("11")).toBe("(11");
    expect(mascararTelefone("1199")).toBe("(11) 99");
    expect(mascararTelefone("1133334444")).toBe("(11) 3333-4444");
    expect(mascararTelefone("11999998888")).toBe("(11) 99999-8888");
  });

  it("ignora o que passa de 11 dígitos em vez de deixar crescer", () => {
    expect(mascararTelefone("119999988889999")).toBe("(11) 99999-8888");
  });
});
