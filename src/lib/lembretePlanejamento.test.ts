import { describe, expect, it } from "vitest";

import { TOTAL_MODULOS, secoesDoModulo } from "./planejamento";
import { dataLocal, deveLembrarHoje, progressoPlanejamento } from "./lembretePlanejamento";

const idsDoModulo = (n: number) => secoesDoModulo(n).map((s) => s.id);

describe("progressoPlanejamento", () => {
  it("sem nada concluído, aponta o módulo 1 com zero seções feitas", () => {
    const p = progressoPlanejamento(new Set());
    expect(p?.modulo).toBe(1);
    expect(p?.feitas).toBe(0);
    expect(p?.total).toBe(secoesDoModulo(1).length);
  });

  it("aponta o primeiro módulo com seção aberta e conta as feitas", () => {
    const concluidas = new Set([...idsDoModulo(1), idsDoModulo(2)[0]]);
    const p = progressoPlanejamento(concluidas);
    expect(p?.modulo).toBe(2);
    expect(p?.feitas).toBe(1);
  });

  it("com os 6 módulos fechados não lembra nada", () => {
    const todas = new Set(
      Array.from({ length: TOTAL_MODULOS }, (_, i) => idsDoModulo(i + 1)).flat(),
    );
    expect(progressoPlanejamento(todas)).toBeNull();
  });
});

describe("deveLembrarHoje", () => {
  it("lembra no primeiro acesso do dia e não repete no mesmo dia", () => {
    expect(deveLembrarHoje(null, "2026-10-05")).toBe(true);
    expect(deveLembrarHoje("2026-10-04", "2026-10-05")).toBe(true);
    expect(deveLembrarHoje("2026-10-05", "2026-10-05")).toBe(false);
  });

  it("usa a data local com zero à esquerda", () => {
    expect(dataLocal(new Date(2026, 0, 7, 23, 50))).toBe("2026-01-07");
  });
});
