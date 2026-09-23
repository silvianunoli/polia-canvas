import { describe, it, expect } from "vitest";
import { REQUISITOS, senhaCumpreRequisitos } from "./senha";

describe("REQUISITOS", () => {
  it("são exatamente três: tamanho, número e maiúscula (o guia visual mostra uma barra de 3 segmentos)", () => {
    expect(REQUISITOS.map((r) => r.id)).toEqual(["len", "num", "up"]);
  });

  it("cada requisito tem um rótulo visível e uma função de teste", () => {
    for (const r of REQUISITOS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(typeof r.teste).toBe("function");
    }
  });

  it("nenhum rótulo usa exclamação, travessão ou emoji (regra de marca)", () => {
    for (const r of REQUISITOS) {
      expect(r.label).not.toMatch(/[!\u2014]/);
      expect(r.label).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("senhaCumpreRequisitos", () => {
  it("aceita senha com 8+ caracteres, 1 número e 1 maiúscula", () => {
    expect(senhaCumpreRequisitos("Polia123")).toBe(true);
  });

  it("aceita exatamente 8 caracteres (limite inclusivo)", () => {
    expect("Abcdef12").toHaveLength(8);
    expect(senhaCumpreRequisitos("Abcdef12")).toBe(true);
  });

  it("bloqueia quando tem 7 caracteres, mesmo com número e maiúscula", () => {
    expect(senhaCumpreRequisitos("Abcde12")).toBe(false);
  });

  it("bloqueia quando não tem número", () => {
    expect(senhaCumpreRequisitos("Poliapolia")).toBe(false);
  });

  it("bloqueia quando não tem letra maiúscula", () => {
    expect(senhaCumpreRequisitos("polia1234")).toBe(false);
  });

  it("bloqueia senha vazia", () => {
    expect(senhaCumpreRequisitos("")).toBe(false);
  });

  it("espaço conta no tamanho, mas não substitui número nem maiúscula", () => {
    expect(senhaCumpreRequisitos("        ")).toBe(false);
    expect(senhaCumpreRequisitos("A 1     ")).toBe(true);
  });

  it("símbolo não é obrigatório (a régua é só tamanho, número e maiúscula)", () => {
    expect(senhaCumpreRequisitos("SemSimbolo1")).toBe(true);
  });

  // A regex de maiúscula é [A-Z]: letra acentuada maiúscula (Á, Ç) não conta.
  // Fica documentado pra ninguém mudar a régua da tela sem querer.
  it("maiúscula acentuada não satisfaz o requisito de maiúscula (regex é [A-Z])", () => {
    expect(senhaCumpreRequisitos("Ávila123")).toBe(false);
    expect(senhaCumpreRequisitos("Ávila12A")).toBe(true);
  });

  it("cada requisito falha isoladamente quando só ele falta", () => {
    const [len, num, up] = REQUISITOS;
    expect(len.teste("Ab1")).toBe(false);
    expect(num.teste("Abcdefgh")).toBe(false);
    expect(up.teste("abcdefg1")).toBe(false);
  });
});
