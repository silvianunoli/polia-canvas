import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CANAL_LABEL, CANAIS_VENDA } from "./vendas";

// O lançamento de venda no Financeiro leva o nome do canal escrito pelo banco
// (canal_venda_nome, VND-40). A tela usa CANAL_LABEL: os dois têm de bater.
const MIGRATION = path.resolve(
  __dirname,
  // Última migration que recriou a função ("Loja da marca" e "Vitrine online",
  // 23/11/2026, ONE-238).
  "../../supabase/migrations/20261124020000_pedido_pagamento.sql",
);

describe("canal_venda_nome", () => {
  const fonte = readFileSync(MIGRATION, "utf8");

  it.each(CANAIS_VENDA.map((c) => [c, CANAL_LABEL[c]]))(
    "o banco escreve %s como %s",
    (canal, nome) => {
      expect(fonte).toContain(`when '${canal}' then '${nome}'`);
    },
  );
});
