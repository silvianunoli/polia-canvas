import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ANDAMENTOS } from "./pedidos";
import { ORDEM_PASSOS } from "./primeirosPassos";

// resgatar_bonus_primeiros_passos() confere a condição escrita à mão no SQL.
// Desde 05/11/2026 (ONE-175, migration 20261105230000) é um pedido entregue, a
// mesma régua do hook usePrimeirosPassos, e o preço não trava mais o bônus.
// Mudou aqui: migration nova lá, senão o Painel promete o bônus e o banco nunca
// entrega (ONE-136).
const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20261105230000_bonus_passos_encomenda_entregue.sql",
);

describe("bônus dos primeiros passos", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("os passos do Painel abrem na encomenda e o preço vem por último", () => {
    expect(ORDEM_PASSOS).toEqual(["pedido", "entregue", "preco"]);
  });

  it("o banco confere o pedido entregue, sem o preço nem o Planejamento", () => {
    expect(sql).toMatch(/andamento = 'entregue' and status <> 'cancelada'/);
    expect(sql).not.toMatch(/calculadora_breakdown|planejamento_secoes|business_name/);
  });

  it("o andamento conferido no banco existe no quadro de Pedidos", () => {
    expect(ANDAMENTOS).toContain("entregue");
  });
});
