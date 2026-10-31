import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ANDAMENTOS } from "./pedidos";
import { ORDEM_PASSOS } from "./primeirosPassos";

// resgatar_bonus_primeiros_passos() confere os passos escritos à mão no SQL.
// Desde 31/10/2026 (migration 20261031200100) são o primeiro preço, o primeiro
// pedido e um pedido entregue, a mesma régua do hook usePrimeirosPassos. Mudou
// aqui: migration nova lá, senão o Painel promete o bônus e o banco nunca
// entrega (ONE-136).
const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20261031200100_bonus_passos_pedido_entregue.sql",
);

describe("bônus dos primeiros passos", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("os passos do Painel são preço, pedido e entregue", () => {
    expect(ORDEM_PASSOS).toEqual(["preco", "pedido", "entregue"]);
  });

  it("o banco confere os mesmos três passos, sem o Planejamento", () => {
    expect(sql).toMatch(/calculadora_breakdown is not null/);
    expect(sql).toMatch(/andamento is not null/);
    expect(sql).toMatch(/andamento = 'entregue' and status <> 'cancelada'/);
    expect(sql).not.toMatch(/planejamento_secoes|business_name/);
  });

  it("o andamento conferido no banco existe no quadro de Pedidos", () => {
    expect(ANDAMENTOS).toContain("entregue");
  });
});
