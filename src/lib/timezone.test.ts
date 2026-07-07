import { describe, it, expect } from "vitest";
import { saoPauloLocalInputToUtcIso, utcIsoToSaoPauloLocalInput } from "./timezone";

// Brasil aboliu o horário de verão em 2019: America/Sao_Paulo é UTC-3 o ano
// inteiro hoje. Por isso os exemplos abaixo não precisam cobrir transição de DST.

describe("saoPauloLocalInputToUtcIso", () => {
  it("converte hora de parede de SP pra ISO em UTC (UTC-3 -> soma 3h)", () => {
    expect(saoPauloLocalInputToUtcIso("2026-07-10T09:00")).toBe("2026-07-10T12:00:00.000Z");
  });

  it("empurra a data pro dia seguinte em UTC quando o horário local é tarde da noite", () => {
    expect(saoPauloLocalInputToUtcIso("2026-07-10T23:30")).toBe("2026-07-11T02:30:00.000Z");
  });

  it("funciona em janeiro (verão no Brasil, mas sem DST desde 2019)", () => {
    expect(saoPauloLocalInputToUtcIso("2026-01-01T00:00")).toBe("2026-01-01T03:00:00.000Z");
  });

  it("é o inverso de utcIsoToSaoPauloLocalInput (round-trip)", () => {
    const original = "2026-03-15T14:45";
    const utc = saoPauloLocalInputToUtcIso(original);
    expect(utcIsoToSaoPauloLocalInput(utc)).toBe(original);
  });
});

describe("utcIsoToSaoPauloLocalInput", () => {
  it("converte ISO em UTC pra hora de parede de SP (UTC-3 -> subtrai 3h)", () => {
    expect(utcIsoToSaoPauloLocalInput("2026-07-10T12:00:00.000Z")).toBe("2026-07-10T09:00");
  });

  it("empurra a data pro dia anterior em hora local quando o UTC é madrugada", () => {
    expect(utcIsoToSaoPauloLocalInput("2026-07-11T02:30:00.000Z")).toBe("2026-07-10T23:30");
  });

  it("preenche mês/dia/hora/minuto com zero à esquerda", () => {
    expect(utcIsoToSaoPauloLocalInput("2026-01-05T06:05:00.000Z")).toBe("2026-01-05T03:05");
  });

  it("é o inverso de saoPauloLocalInputToUtcIso (round-trip)", () => {
    const originalUtc = "2026-09-01T18:00:00.000Z";
    const local = utcIsoToSaoPauloLocalInput(originalUtc);
    expect(saoPauloLocalInputToUtcIso(local)).toBe(originalUtc);
  });
});
