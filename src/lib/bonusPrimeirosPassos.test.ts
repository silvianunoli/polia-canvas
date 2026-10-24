import { describe, expect, it } from "vitest";
import { secoesDoModulo } from "./planejamento";

// resgatar_bonus_primeiros_passos() (migration 20261023330000) confere o
// Módulo 1 pelas seções escritas à mão no SQL. Mudou aqui: migration nova lá,
// senão o Painel promete o bônus e o banco nunca entrega (ONE-136).
describe("bônus dos primeiros passos", () => {
  it("as seções do Módulo 1 são as mesmas do banco", () => {
    expect(secoesDoModulo(1).map((s) => s.id)).toEqual(["1.1", "1.2", "1.3", "1.4", "1.5"]);
  });
});
