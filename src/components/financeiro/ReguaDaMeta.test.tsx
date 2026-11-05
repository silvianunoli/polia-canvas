import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { estiloNaRegua, pctDaMarca, pctDaMeta, type MarcaDaRegua } from "@/lib/reguaDaMeta";
import { ReguaDaMeta } from "./ReguaDaMeta";

beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

const marcas: MarcaDaRegua[] = [
  { chave: "min", rotulo: "mínimo · R$ 4.500,00", detalhe: "paga tudo", num: 4500 },
  { chave: "cel", rotulo: "celebrar · R$ 12.000,00", detalhe: "mês de festa", num: 12000 },
];

/** Onde o rótulo começa e termina, pelas mesmas contas que o CSS faz. */
function faixa(pct: number, trilho: number, rotulo: number) {
  const { left, transform } = estiloNaRegua(pct);
  const inicio =
    (parseFloat(left) / 100) * trilho +
    (parseFloat(transform.replace("translateX(", "")) / 100) * rotulo;
  return { inicio, fim: inicio + rotulo };
}

describe("estiloNaRegua (ONE-171)", () => {
  // Trilho de 360 e 402 px de tela, com selo curto e selo de valor alto.
  it.each([
    [264, 180],
    [264, 230],
    [306, 180],
    [306, 230],
  ])("rótulo fica dentro do trilho de %i px com %i px de largura", (trilho, rotulo) => {
    for (let pct = 0; pct <= 100; pct += 0.5) {
      const { inicio, fim } = faixa(pct, trilho, rotulo);
      expect(inicio).toBeGreaterThanOrEqual(-0.001);
      expect(fim).toBeLessThanOrEqual(trilho + 0.001);
    }
  });

  it("o ponto da régua fica embaixo do rótulo", () => {
    for (let pct = 0; pct <= 100; pct += 0.5) {
      const ponto = (pct / 100) * 306;
      const { inicio, fim } = faixa(pct, 306, 180);
      expect(ponto).toBeGreaterThanOrEqual(inicio - 0.001);
      expect(ponto).toBeLessThanOrEqual(fim + 0.001);
    }
  });

  it("valor fora de 0 a 100 não empurra o rótulo pra fora", () => {
    expect(estiloNaRegua(-5).left).toBe("0%");
    expect(estiloNaRegua(130).left).toBe("100%");
  });
});

describe("pctDaMeta e pctDaMarca", () => {
  it("o que entrou para em 100%, e sem meta dá 0", () => {
    expect(pctDaMeta(990, 8000)).toBeCloseTo(12.375);
    expect(pctDaMeta(15000, 8000)).toBe(100);
    expect(pctDaMeta(990, 0)).toBe(0);
  });

  it("a marca para em 99%", () => {
    expect(pctDaMarca(4500, 8000)).toBeCloseTo(56.25);
    expect(pctDaMarca(12000, 8000)).toBe(99);
  });
});

describe("ReguaDaMeta", () => {
  it("o caso do print: rótulos e selo ficam fora do trilho, cada um na sua linha", () => {
    render(<ReguaDaMeta entradas={990} metaAlvo={8000} marcas={marcas} />);
    const trilho = screen.getByRole("progressbar");
    const minimo = screen.getByText("mínimo · R$ 4.500,00");
    const celebrar = screen.getByText("celebrar · R$ 12.000,00");
    const selo = screen.getByText(/entraram até aqui/);

    for (const rotulo of [minimo, celebrar, selo]) {
      expect(trilho.contains(rotulo)).toBe(false);
      // No fluxo da página: absoluto voltava a cobrir o título e o outro rótulo.
      expect(rotulo.className).not.toContain("absolute");
      expect(rotulo.className).not.toContain("whitespace-nowrap");
      expect(rotulo.className).toContain("max-w-full");
    }
    expect(minimo.parentElement).toBe(celebrar.parentElement);
    expect(minimo.parentElement?.className).toContain("flex-col");
    expect(selo.style.left).toBe("12.375%");
    expect(selo.style.transform).toBe("translateX(-12.375%)");
  });

  it("guarda a frase inteira no title da marca e o valor no leitor de tela", () => {
    render(<ReguaDaMeta entradas={990} metaAlvo={8000} marcas={marcas} />);
    expect(screen.getByText("mínimo · R$ 4.500,00").title).toBe("paga tudo");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("12");
  });

  it("sem marcas, mostra só o trilho e o selo", () => {
    render(<ReguaDaMeta entradas={0} metaAlvo={8000} marcas={[]} />);
    expect(screen.getByText(/entraram até aqui/).style.left).toBe("0%");
    expect(screen.queryByText(/mínimo/)).toBeNull();
  });
});
