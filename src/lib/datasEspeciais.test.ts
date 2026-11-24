import { describe, expect, it } from "vitest";
import { datasDoAno, datasNoIntervalo, pascoa } from "./datasEspeciais";

const dia = (ano: number, nome: string) => datasDoAno(ano).find((d) => d.nome === nome)?.dia;

describe("pascoa", () => {
  it("bate com o calendário oficial", () => {
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2027)).toBe("2027-03-28");
    expect(pascoa(2028)).toBe("2028-04-16");
  });
});

describe("datas móveis", () => {
  it("Carnaval, Sexta-feira Santa e Corpus Christi saem da Páscoa", () => {
    expect(dia(2027, "Carnaval")).toBe("2027-02-09");
    expect(dia(2027, "Sexta-feira Santa")).toBe("2027-03-26");
    expect(dia(2027, "Corpus Christi")).toBe("2027-05-27");
  });

  it("Dia das Mães e Dia dos Pais caem no 2º domingo", () => {
    expect(dia(2027, "Dia das Mães")).toBe("2027-05-09");
    expect(dia(2027, "Dia dos Pais")).toBe("2027-08-08");
  });

  it("Black Friday é o dia depois da 4ª quinta de novembro", () => {
    expect(dia(2026, "Black Friday")).toBe("2026-11-27");
    expect(dia(2026, "Cyber Monday")).toBe("2026-11-30");
    // 2029: a 4ª quinta é 22/11, então a Black Friday não é a última sexta (30/11).
    expect(dia(2029, "Black Friday")).toBe("2029-11-23");
  });
});

describe("datasNoIntervalo", () => {
  it("a grade de dezembro atravessa o ano", () => {
    const m = datasNoIntervalo("2026-11-29", "2027-01-02");
    expect(m.get("2026-12-25")?.map((d) => d.nome)).toEqual(["Natal"]);
    expect(m.get("2027-01-01")?.map((d) => d.nome)).toEqual(["Confraternização Universal"]);
    expect(m.get("2026-11-30")?.map((d) => d.nome)).toEqual(["Cyber Monday"]);
    expect(m.has("2026-11-27")).toBe(false);
  });

  it("12/10 tem o feriado antes do Dia das Crianças", () => {
    const m = datasNoIntervalo("2026-10-12", "2026-10-12");
    expect(m.get("2026-10-12")?.map((d) => d.tipo)).toEqual(["feriado", "comercio"]);
  });
});
