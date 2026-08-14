import { describe, it, expect } from "vitest";
import { sanitizarTextoIA } from "./sanitizarTextoIA";

describe("sanitizarTextoIA", () => {
  // Regra A: entre dígitos é intervalo, vira hífen simples.
  it("A: travessão/meia-risca entre dígitos vira hífen", () => {
    expect(sanitizarTextoIA("10—20")).toBe("10-20");
    expect(sanitizarTextoIA("R$ 30–60")).toBe("R$ 30-60");
    expect(sanitizarTextoIA("de 10 — 20 unidades")).toBe("de 10-20 unidades");
  });

  // Regra B: qualquer outro vira ", " sem espaço antes da vírgula.
  it("B: travessão no meio de frase vira vírgula com um espaço", () => {
    expect(sanitizarTextoIA("o preço — o do carro-chefe")).toBe("o preço, o do carro-chefe");
    expect(sanitizarTextoIA("o preço—o do carro-chefe")).toBe("o preço, o do carro-chefe");
    expect(sanitizarTextoIA("meia–risca também")).toBe("meia, risca também");
  });

  // Regra C: início de linha/string some com o espaço seguinte.
  it("C: travessão no início de linha ou da string é removido, não vira vírgula", () => {
    expect(sanitizarTextoIA("— primeira ideia")).toBe("primeira ideia");
    expect(sanitizarTextoIA("linha um\n— linha dois")).toBe("linha um\nlinha dois");
  });

  // Regra D: nunca vírgula duplicada.
  it("D: substituição nunca gera vírgula duplicada", () => {
    expect(sanitizarTextoIA("a —, b")).toBe("a, b");
    expect(sanitizarTextoIA("a, — b")).toBe("a, b");
    expect(sanitizarTextoIA("palavra —.")).toBe("palavra.");
  });

  it("cobre U+2015 (barra horizontal) como travessão", () => {
    expect(sanitizarTextoIA("um ― dois")).toBe("um, dois");
  });

  it("U+2011 (hífen não separável) vira hífen simples, nunca vírgula", () => {
    expect(sanitizarTextoIA("e‑mail")).toBe("e-mail");
  });

  it("travessão pendurado no fim de linha some sem deixar vírgula órfã", () => {
    expect(sanitizarTextoIA("pensando —\noutra linha")).toBe("pensando\noutra linha");
    expect(sanitizarTextoIA("fim da resposta —")).toBe("fim da resposta");
  });

  it("frase real em português sai limpa e legível", () => {
    expect(
      sanitizarTextoIA("Esse mês tem pouco registrado — a leitura é limitada. O bolo — que é o carro-chefe — sobrou 40%."),
    ).toBe("Esse mês tem pouco registrado, a leitura é limitada. O bolo, que é o carro-chefe, sobrou 40%.");
  });

  it("não mexe em texto sem travessão (hífen comum fica)", () => {
    const texto = "carro-chefe custa R$ 1.000,00, sobra 40%";
    expect(sanitizarTextoIA(texto)).toBe(texto);
  });
});
