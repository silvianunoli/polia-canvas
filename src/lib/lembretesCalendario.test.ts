import { describe, expect, it } from "vitest";
import {
  avisoLembretes,
  avisosDoDia,
  montarEmailLembretes,
  ocorreEm,
  ocorrenciasNoIntervalo,
  quando,
  type Lembrete,
} from "../../supabase/functions/_shared/lembretesCalendario.ts";

function lembrete(parcial: Partial<Lembrete>): Lembrete {
  return {
    id: "l1",
    titulo: "Mandar o relatório pra contabilidade",
    observacao: null,
    dia: "2026-12-05",
    horario: null,
    repeticao: "nenhuma",
    avisar_dias_antes: 1,
    feitos: [],
    ...parcial,
  };
}

describe("ocorreEm", () => {
  it("sem repetição, só no dia marcado", () => {
    const l = lembrete({});
    expect(ocorreEm(l, "2026-12-05")).toBe(true);
    expect(ocorreEm(l, "2027-01-05")).toBe(false);
  });

  it("nunca antes da primeira ocorrência", () => {
    expect(ocorreEm(lembrete({ repeticao: "mensal" }), "2026-11-05")).toBe(false);
  });

  it("toda semana cai no mesmo dia da semana", () => {
    const l = lembrete({ repeticao: "semanal" });
    expect(ocorreEm(l, "2026-12-12")).toBe(true);
    expect(ocorreEm(l, "2027-01-02")).toBe(true);
    expect(ocorreEm(l, "2026-12-13")).toBe(false);
  });

  it("todo mês no dia 31 cai no último dia dos meses curtos", () => {
    const l = lembrete({ dia: "2027-01-31", repeticao: "mensal" });
    expect(ocorreEm(l, "2027-02-28")).toBe(true);
    expect(ocorreEm(l, "2027-04-30")).toBe(true);
    expect(ocorreEm(l, "2027-05-31")).toBe(true);
    expect(ocorreEm(l, "2027-05-30")).toBe(false);
  });

  it("todo ano em 29/02 cai em 28/02 no ano comum", () => {
    const l = lembrete({ dia: "2028-02-29", repeticao: "anual" });
    expect(ocorreEm(l, "2029-02-28")).toBe(true);
    expect(ocorreEm(l, "2032-02-29")).toBe(true);
    expect(ocorreEm(l, "2032-02-28")).toBe(false);
  });
});

describe("ocorrenciasNoIntervalo", () => {
  it("todo mês aparece uma vez na grade de dezembro", () => {
    const l = lembrete({ dia: "2026-10-05", repeticao: "mensal" });
    expect(ocorrenciasNoIntervalo(l, "2026-11-29", "2027-01-02")).toEqual(["2026-12-05"]);
  });

  it("toda semana começa na primeira ocorrência, não no início da grade", () => {
    const l = lembrete({ dia: "2026-12-16", repeticao: "semanal" });
    expect(ocorrenciasNoIntervalo(l, "2026-11-29", "2027-01-02")).toEqual([
      "2026-12-16",
      "2026-12-23",
      "2026-12-30",
    ]);
  });

  it("sem repetição fora da grade não aparece", () => {
    expect(ocorrenciasNoIntervalo(lembrete({}), "2027-01-01", "2027-01-31")).toEqual([]);
  });
});

describe("avisosDoDia", () => {
  it("avisa 1 dia antes", () => {
    const l = lembrete({});
    expect(avisosDoDia([l], "2026-12-04")).toEqual([{ lembrete: l, ocorrencia: "2026-12-05" }]);
    expect(avisosDoDia([l], "2026-12-05")).toEqual([]);
  });

  it("sem aviso não avisa", () => {
    expect(avisosDoDia([lembrete({ avisar_dias_antes: null })], "2026-12-04")).toEqual([]);
  });

  it("ocorrência marcada como feita não avisa, a do mês seguinte sim", () => {
    const l = lembrete({ repeticao: "mensal", avisar_dias_antes: 0, feitos: ["2026-12-05"] });
    expect(avisosDoDia([l], "2026-12-05")).toEqual([]);
    expect(avisosDoDia([l], "2027-01-05")).toHaveLength(1);
  });

  it("aviso de 1 semana antes atravessa o mês", () => {
    const l = lembrete({ dia: "2026-12-03", repeticao: "mensal", avisar_dias_antes: 7 });
    expect(avisosDoDia([l], "2026-11-26")).toEqual([{ lembrete: l, ocorrencia: "2026-12-03" }]);
  });
});

describe("texto do aviso", () => {
  it("diz quando cai", () => {
    expect(quando("2026-12-05", "2026-12-05")).toBe("hoje");
    expect(quando("2026-12-05", "2026-12-04")).toBe("amanhã, 05/12");
    expect(quando("2026-12-05", "2026-12-02")).toBe("em 3 dias, 05/12");
  });

  it("push de um lembrete leva o nome e a hora", () => {
    const l = lembrete({ horario: "09:00:00" });
    const aviso = avisoLembretes([{ lembrete: l, ocorrencia: "2026-12-05" }], "2026-12-04");
    expect(aviso.titulo).toBe("Mandar o relatório pra contabilidade");
    expect(aviso.corpo).toBe("Lembrete do Calendário: amanhã, 05/12 às 09:00.");
    expect(aviso.rota).toBe("/calendario");
  });

  it("push de vários conta quantos", () => {
    const a = { lembrete: lembrete({}), ocorrencia: "2026-12-05" };
    expect(avisoLembretes([a, a], "2026-12-04").titulo).toBe("2 lembretes no Calendário");
  });

  it("e-mail escapa o que ela escreveu", () => {
    const l = lembrete({ titulo: "<b>Contadora</b>", observacao: "Levar extrato & notas" });
    const email = montarEmailLembretes([{ lembrete: l, ocorrencia: "2026-12-05" }], "2026-12-04");
    expect(email.assunto).toBe("Lembrete: <b>Contadora</b>");
    expect(email.html).not.toContain("<b>Contadora</b>");
    expect(email.html).toContain("&lt;b&gt;Contadora&lt;/b&gt;");
    expect(email.texto).toContain("Levar extrato & notas");
  });
});
