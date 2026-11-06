import { describe, expect, it } from "vitest";
import { dentroDoPrazoFundadora, tiersPagosDaConta } from "./fundadora";
import { tiersPagos } from "./planos";

const noPrazo = Date.parse("2026-11-15T12:00:00-03:00");
const depois = Date.parse("2026-12-01T00:00:01-03:00");

describe("preço honrado até 30/11 (decisão da Sil em 06/11/2026)", () => {
  it("o prazo termina no último segundo de 30/11 em Brasília", () => {
    expect(dentroDoPrazoFundadora(Date.parse("2026-11-30T23:59:59-03:00"))).toBe(true);
    expect(dentroDoPrazoFundadora(depois)).toBe(false);
  });

  it("quem recebeu a promessa vê o preço antigo no mensal e no anual", () => {
    const t = tiersPagosDaConta(true, noPrazo);
    expect([t.controle.precoMensal, t.controle.precoAnual]).toEqual([29.9, 299]);
    expect([t.projete.precoMensal, t.projete.precoAnual]).toEqual([47.9, 479]);
  });

  it("a lista de recursos é a de hoje: só o preço volta", () => {
    const t = tiersPagosDaConta(true, noPrazo);
    expect(t.controle.beneficios).toEqual(tiersPagos(noPrazo).controle.beneficios);
    expect(t.projete.beneficios).toEqual(tiersPagos(noPrazo).projete.beneficios);
  });

  it("quem não recebeu, ou passou do prazo, vê o preço público", () => {
    expect(tiersPagosDaConta(false, noPrazo)).toEqual(tiersPagos(noPrazo));
    expect(tiersPagosDaConta(true, depois)).toEqual(tiersPagos(depois));
    expect(tiersPagosDaConta(false, noPrazo).controle.precoMensal).toBe(39.9);
  });
});
