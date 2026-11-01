import { describe, expect, it } from "vitest";
import { nomeBate } from "./tipos";

describe("nomeBate (busca do Catálogo de Produtos)", () => {
  it("acha sem diferença de maiúscula", () => {
    expect(nomeBate("Bolsa Beverly - Fio de Malha", "beverly")).toBe(true);
  });
  it("acha sem diferença de acento", () => {
    expect(nomeBate("Bolsa Lilás", "lilas")).toBe(true);
    expect(nomeBate("Bolsa Lilas", "lilás")).toBe(true);
  });
  it("busca vazia mostra tudo", () => {
    expect(nomeBate("Dusk Bag", "  ")).toBe(true);
  });
  it("não acha o que não está no nome", () => {
    expect(nomeBate("Bolsa Amy", "jenny")).toBe(false);
  });
});
