import { describe, expect, it } from "vitest";
import { ddmm, distribuirTarefasPorDia, inicioDoIntervalo } from "./calendarioTarefas";

const t = (id: string, data_inicio: string | null, prazo: string) => ({ id, data_inicio, prazo });

// Grade de outubro/2026 começando no domingo 27/09 e terminando no sábado 31/10.
const INI = "2026-09-27";
const FIM = "2026-10-31";

function papeis(mapa: ReturnType<typeof distribuirTarefasPorDia>, id: string) {
  const out: Record<string, string> = {};
  for (const [dia, lista] of mapa) {
    for (const o of lista) if (o.tarefa.id === id) out[dia] = o.papel;
  }
  return out;
}

describe("distribuirTarefasPorDia", () => {
  it("tarefa sem data_inicio aparece só no prazo", () => {
    const m = distribuirTarefasPorDia([t("a", null, "2026-10-10")], INI, FIM);
    expect(papeis(m, "a")).toEqual({ "2026-10-10": "prazo" });
  });

  it("tarefa com início igual ao prazo aparece só no prazo", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-10-10", "2026-10-10")], INI, FIM);
    expect(papeis(m, "a")).toEqual({ "2026-10-10": "prazo" });
  });

  it("início depois do prazo (dado torto) cai só no prazo", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-10-15", "2026-10-10")], INI, FIM);
    expect(papeis(m, "a")).toEqual({ "2026-10-10": "prazo" });
  });

  it("tarefa com intervalo aparece em todos os dias, com início e prazo marcados", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-10-05", "2026-10-08")], INI, FIM);
    expect(papeis(m, "a")).toEqual({
      "2026-10-05": "inicio",
      "2026-10-06": "andamento",
      "2026-10-07": "andamento",
      "2026-10-08": "prazo",
    });
  });

  it("intervalo que vira o mês respeita a virada de dia", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-09-29", "2026-10-02")], INI, FIM);
    expect(Object.keys(papeis(m, "a"))).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("tarefa que começou antes da grade ganha o começo no primeiro dia visível", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-09-01", "2026-09-29")], INI, FIM);
    expect(papeis(m, "a")).toEqual({
      "2026-09-27": "inicio",
      "2026-09-28": "andamento",
      "2026-09-29": "prazo",
    });
  });

  it("tarefa com prazo depois da grade vai até o último dia visível sem marcar prazo", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-10-30", "2026-11-15")], INI, FIM);
    expect(papeis(m, "a")).toEqual({
      "2026-10-30": "inicio",
      "2026-10-31": "andamento",
    });
  });

  it("tarefa que atravessa a grade inteira aparece no primeiro dia como começo", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-09-01", "2026-12-01")], INI, FIM);
    const p = papeis(m, "a");
    expect(p["2026-09-27"]).toBe("inicio");
    expect(p["2026-10-31"]).toBe("andamento");
    expect(Object.keys(p)).toHaveLength(35);
  });

  it("tarefa fora da grade não aparece", () => {
    const m = distribuirTarefasPorDia(
      [
        t("a", "2026-08-01", "2026-09-20"),
        t("b", "2026-11-05", "2026-11-10"),
        t("c", null, "2026-11-01"),
      ],
      INI,
      FIM,
    );
    expect(m.size).toBe(0);
  });

  it("aceita data com hora e corta pros 10 primeiros caracteres", () => {
    const m = distribuirTarefasPorDia([t("a", "2026-10-05T00:00:00", "2026-10-06")], INI, FIM);
    expect(papeis(m, "a")).toEqual({ "2026-10-05": "inicio", "2026-10-06": "prazo" });
  });
});

describe("auxiliares", () => {
  it("ddmm formata dia/mês", () => {
    expect(ddmm("2026-10-08")).toBe("08/10");
  });
  it("inicioDoIntervalo devolve null sem intervalo", () => {
    expect(inicioDoIntervalo(t("a", null, "2026-10-08"))).toBeNull();
    expect(inicioDoIntervalo(t("a", "2026-10-08", "2026-10-08"))).toBeNull();
    expect(inicioDoIntervalo(t("a", "2026-10-01", "2026-10-08"))).toBe("2026-10-01");
  });
});
