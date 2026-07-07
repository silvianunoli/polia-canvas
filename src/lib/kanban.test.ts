import { describe, it, expect } from "vitest";
import { pluralizeKanban, type KanbanCounts } from "./kanban";

const counts = (a_fazer: number, brotando: number, floresceu: number): KanbanCounts => ({
  a_fazer,
  brotando,
  floresceu,
});

describe("pluralizeKanban", () => {
  it("usa a frase de zero quando todas as colunas estão vazias", () => {
    expect(pluralizeKanban(counts(0, 0, 0))).toBe(
      "nada pra fazer ainda · nada em progresso · nada pronto ainda",
    );
  });

  it("usa singular quando cada coluna tem exatamente 1 item", () => {
    expect(pluralizeKanban(counts(1, 1, 1))).toBe("1 tarefa pra fazer · 1 em progresso · 1 pronta");
  });

  it("usa plural quando cada coluna tem mais de 1 item", () => {
    expect(pluralizeKanban(counts(2, 3, 4))).toBe("2 tarefas pra fazer · 3 em progresso · 4 prontas");
  });

  it("mistura singular, plural e zero na mesma chamada", () => {
    expect(pluralizeKanban(counts(0, 1, 5))).toBe("nada pra fazer ainda · 1 em progresso · 5 prontas");
  });
});
