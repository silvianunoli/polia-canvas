import { describe, expect, it } from "vitest";
import {
  diasRestantes,
  testeAberto,
  testeAcabouHaPouco,
  testeDoBanco,
  textoFaixaTeste,
  type TestePro,
} from "./testePro";

const DIA = 24 * 60 * 60 * 1000;
const agora = Date.parse("2026-10-20T12:00:00-03:00");
const teste = (fimEmDias: number, extra: Partial<TestePro> = {}): TestePro => ({
  inicio: new Date(agora - DIA).toISOString(),
  fim: new Date(agora + fimEmDias * DIA).toISOString(),
  encerradoEm: null,
  resultado: null,
  ...extra,
});

describe("testePro", () => {
  it("aberto só antes do fim e sem encerramento", () => {
    expect(testeAberto(null, agora)).toBe(false);
    expect(testeAberto(teste(3), agora)).toBe(true);
    expect(testeAberto(teste(-0.1), agora)).toBe(false);
    expect(testeAberto(teste(3, { encerradoEm: new Date(agora).toISOString() }), agora)).toBe(
      false,
    );
  });

  it("dias restantes arredondam pra cima e o último dia é 1", () => {
    expect(diasRestantes(teste(6.9), agora)).toBe(7);
    expect(diasRestantes(teste(5.01), agora)).toBe(6);
    expect(diasRestantes(teste(0.2), agora)).toBe(1);
    expect(diasRestantes(teste(-1), agora)).toBe(0);
  });

  it("faixa: dias, último dia, urgência nos 2 últimos", () => {
    expect(textoFaixaTeste(teste(4.5), agora)?.texto).toMatch(/^Faltam 5 dias do teste do Pro/);
    expect(textoFaixaTeste(teste(4.5), agora)?.urgente).toBe(false);
    expect(textoFaixaTeste(teste(1.5), agora)?.urgente).toBe(true);
    expect(textoFaixaTeste(teste(0.3), agora)?.texto).toMatch(/^Último dia/);
  });

  it("depois que acaba lembra por 3 dias, só quem voltou pro Grátis", () => {
    const voltou = teste(-1, {
      encerradoEm: new Date(agora - 2 * DIA).toISOString(),
      resultado: "voltou_gratis",
    });
    expect(testeAcabouHaPouco(voltou, agora)).toBe(true);
    expect(textoFaixaTeste(voltou, agora)?.cta).toBe("Quero o Pro de volta");
    expect(
      testeAcabouHaPouco(
        { ...voltou, encerradoEm: new Date(agora - 4 * DIA).toISOString() },
        agora,
      ),
    ).toBe(false);
    expect(textoFaixaTeste({ ...voltou, resultado: "assinou" }, agora)).toBeNull();
  });

  it("texto sem travessão, exclamação nem promessa com você", () => {
    for (const t of [
      teste(4),
      teste(0.5),
      teste(-1, { encerradoEm: new Date(agora).toISOString(), resultado: "voltou_gratis" }),
    ]) {
      const f = textoFaixaTeste(t, agora)!;
      expect(`${f.texto} ${f.cta}`).not.toMatch(/[—–!]|você consegue|você merece/);
    }
  });

  it("linha do banco", () => {
    expect(testeDoBanco(null)).toBeNull();
    expect(
      testeDoBanco({ inicio: "a", fim: "b", encerrado_em: null, resultado: "xpto" })?.resultado,
    ).toBeNull();
  });
});
