import { describe, expect, it } from "vitest";
import { progressoPct } from "./metas";

describe("progressoPct", () => {
  it("proporção arredondada", () => {
    expect(progressoPct({ valor_atual: 250, valor_alvo: 1000 })).toBe(25);
    expect(progressoPct({ valor_atual: 1, valor_alvo: 3 })).toBe(33);
  });

  it("valor atual negativo não desenha barra negativa (QA-32)", () => {
    expect(progressoPct({ valor_atual: -500, valor_alvo: 1000 })).toBe(0);
  });

  it("passou do alvo trava em 100", () => {
    expect(progressoPct({ valor_atual: 1500, valor_alvo: 1000 })).toBe(100);
  });

  it("sem alvo, alvo zero ou negativo: 0", () => {
    expect(progressoPct({ valor_atual: 10, valor_alvo: null })).toBe(0);
    expect(progressoPct({ valor_atual: 10, valor_alvo: 0 })).toBe(0);
    expect(progressoPct({ valor_atual: 10, valor_alvo: -5 })).toBe(0);
  });

  it("valor atual nulo conta como zero", () => {
    expect(progressoPct({ valor_atual: null, valor_alvo: 100 })).toBe(0);
  });
});
