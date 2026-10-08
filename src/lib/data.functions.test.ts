import { describe, it, expect, vi, afterEach } from "vitest";
import {
  hojeISO,
  mesAnoDe,
  mesAnoAtual,
  ehMesAtual,
  diaLocalDe,
  hojeEmBrasilia,
  mesEmBrasilia,
  mesAnoEmBrasilia,
} from "./data.functions";

// Instante em Brasília (UTC-3 o ano inteiro) escrito como UTC: hora BRT + 3.
const brt = (ano: number, mes: number, dia: number, h: number, min: number) =>
  new Date(Date.UTC(ano, mes - 1, dia, h + 3, min));

describe("hojeEmBrasilia (servidor em UTC)", () => {
  it("20h59 de Brasília ainda é o mesmo dia", () => {
    expect(hojeEmBrasilia(brt(2026, 10, 7, 20, 59))).toBe("2026-10-07");
  });

  it("21h00 de Brasília (meia-noite UTC) continua no dia dela", () => {
    const agora = brt(2026, 10, 7, 21, 0);
    expect(agora.toISOString().slice(0, 10)).toBe("2026-10-08"); // o bug antigo
    expect(hojeEmBrasilia(agora)).toBe("2026-10-07");
  });

  it("23h59 de Brasília ainda é o mesmo dia", () => {
    expect(hojeEmBrasilia(brt(2026, 10, 7, 23, 59))).toBe("2026-10-07");
  });

  it("vira à meia-noite de Brasília", () => {
    expect(hojeEmBrasilia(brt(2026, 10, 8, 0, 0))).toBe("2026-10-08");
  });

  it("virada de mês: 31/10 às 21h30 ainda é outubro", () => {
    const agora = brt(2026, 10, 31, 21, 30);
    expect(mesEmBrasilia(agora)).toBe("2026-10");
    expect(mesAnoEmBrasilia(agora)).toEqual({ ano: 2026, mes: 10 });
    expect(mesEmBrasilia(brt(2026, 11, 1, 0, 0))).toBe("2026-11");
  });

  it("virada de ano: 31/12 às 23h59 ainda é o ano velho", () => {
    const agora = brt(2026, 12, 31, 23, 59);
    expect(hojeEmBrasilia(agora)).toBe("2026-12-31");
    expect(mesAnoEmBrasilia(agora)).toEqual({ ano: 2026, mes: 12 });
    expect(hojeEmBrasilia(brt(2027, 1, 1, 0, 0))).toBe("2027-01-01");
  });

  it("formato sempre AAAA-MM-DD com zero à esquerda", () => {
    expect(hojeEmBrasilia(brt(2027, 1, 5, 9, 0))).toBe("2027-01-05");
  });
});

describe("diaLocalDe", () => {
  it("dia inteiro (AAAA-MM-DD) volta igual, sem cair no dia anterior", () => {
    expect(diaLocalDe("2026-10-07")).toBe("2026-10-07");
  });

  it("data com hora em UTC vira o dia LOCAL, não os 10 primeiros caracteres", () => {
    // 22h30 local de 07/10: em UTC (Brasília) já é 08/10.
    const local = new Date(2026, 9, 7, 22, 30, 0);
    expect(diaLocalDe(local.toISOString())).toBe("2026-10-07");
  });

  it("23h59 local do último dia do ano continua no ano velho", () => {
    const local = new Date(2026, 11, 31, 23, 59, 0);
    expect(diaLocalDe(local.toISOString())).toBe("2026-12-31");
  });
});

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
