import { describe, expect, it } from "vitest";
import { idsAcimaDaCota } from "./cotaExcedente";

describe("idsAcimaDaCota", () => {
  it("dentro da cota, nada é excedente", () => {
    expect(idsAcimaDaCota([{ id: "a", created_at: "2026-10-01T10:00:00Z" }], 1).size).toBe(0);
    expect(idsAcimaDaCota([], 1).size).toBe(0);
  });

  it("o mais antigo fica na cota e os mais novos viram excedente, fora de ordem", () => {
    const ids = idsAcimaDaCota(
      [
        { id: "novo", created_at: "2026-10-05T10:00:00Z" },
        { id: "antigo", created_at: "2026-09-01T10:00:00Z" },
        { id: "meio", created_at: "2026-09-20T10:00:00Z" },
      ],
      1,
    );
    expect([...ids].sort()).toEqual(["meio", "novo"]);
  });

  it("empate de created_at desempata pelo id, como a trigger do banco", () => {
    const ids = idsAcimaDaCota(
      [
        { id: "bbb", created_at: "2026-10-01T10:00:00Z" },
        { id: "aaa", created_at: "2026-10-01T10:00:00Z" },
      ],
      1,
    );
    expect([...ids]).toEqual(["bbb"]);
  });

  it("limite maior respeita a quantidade", () => {
    const itens = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      created_at: `2026-10-0${i + 1}T10:00:00Z`,
    }));
    expect([...idsAcimaDaCota(itens, 5)]).toEqual(["p5", "p6"]);
  });

  it("não muda o array de entrada", () => {
    const itens = [
      { id: "b", created_at: "2026-10-02" },
      { id: "a", created_at: "2026-10-01" },
    ];
    idsAcimaDaCota(itens, 1);
    expect(itens.map((i) => i.id)).toEqual(["b", "a"]);
  });
});
