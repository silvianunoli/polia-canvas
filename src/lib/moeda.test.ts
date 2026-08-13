import { describe, it, expect } from "vitest";
import { moedaParaPrompt } from "./moeda";

// Este arquivo existe por causa de um defeito real: os prompts do Raio-x e da
// Aimer interpolavam `valor.toFixed(2)`, e o modelo repetia o formato recebido.
// A tela do Raio-x saía dizendo "R$ 8780.00 de entrada" pra uma cliente pagante.
describe("moedaParaPrompt", () => {
  it("usa ponto de milhar e vírgula decimal", () => {
    expect(moedaParaPrompt(8780)).toBe("R$ 8.780,00");
    expect(moedaParaPrompt(2390.5)).toBe("R$ 2.390,50");
  });

  it("nunca produz o formato americano que causou o bug", () => {
    for (const v of [8780, 2390.5, 6390, 1000000, 0.5]) {
      expect(moedaParaPrompt(v)).not.toMatch(/\d\.\d{2}$/);
    }
  });

  it("mantém duas casas mesmo em valor redondo e em zero", () => {
    expect(moedaParaPrompt(0)).toBe("R$ 0,00");
    expect(moedaParaPrompt(1000)).toBe("R$ 1.000,00");
  });

  it("arredonda a duas casas em vez de vazar precisão binária", () => {
    expect(moedaParaPrompt(898.5714285714286)).toBe("R$ 898,57");
  });

  it("preserva o sinal em valor negativo", () => {
    expect(moedaParaPrompt(-320)).toBe("R$ -320,00");
  });

  it("separa o R$ com espaço comum, não espaço não separável", () => {
    // toLocaleString com style:'currency' insere U+00A0 depois do "R$"; o
    // modelo reproduz esse caractere e ele vaza pra tela.
    expect(moedaParaPrompt(10)).not.toContain(" ");
    expect(moedaParaPrompt(10)).toBe("R$ 10,00");
  });
});
