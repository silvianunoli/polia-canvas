import { describe, it, expect, vi, afterEach } from "vitest";
import { hojeISO, mesAnoDe, mesAnoAtual, ehMesAtual } from "./data.functions";

afterEach(() => vi.useRealTimers());

describe("hojeISO", () => {
  it("devolve a data LOCAL em AAAA-MM-DD, não a UTC", () => {
    // 23h59 local de 15/09: em UTC já pode ser dia 16, mas o dia dela é 15.
    vi.useFakeTimers({ now: new Date(2026, 8, 15, 23, 59, 0) });
    expect(hojeISO()).toBe("2026-09-15");
  });

  it("primeiro minuto do dia local ainda é o dia local", () => {
    vi.useFakeTimers({ now: new Date(2026, 0, 1, 0, 1, 0) });
    expect(hojeISO()).toBe("2026-01-01");
  });
});

describe("mesAnoDe", () => {
  it("quebra a ISO em ano e mês numéricos", () => {
    expect(mesAnoDe("2026-09-22")).toEqual({ ano: 2026, mes: 9 });
    expect(mesAnoDe("2025-12-01")).toEqual({ ano: 2025, mes: 12 });
  });
});

describe("mesAnoAtual e ehMesAtual", () => {
  it("compara ano E mês (setembro de outro ano não é o mês atual)", () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 22, 12, 0, 0) });
    expect(mesAnoAtual()).toEqual({ ano: 2026, mes: 9 });
    expect(ehMesAtual("2026-09-01")).toBe(true);
    expect(ehMesAtual("2026-09-30")).toBe(true);
    expect(ehMesAtual("2026-08-31")).toBe(false);
    expect(ehMesAtual("2025-09-22")).toBe(false);
  });
});
