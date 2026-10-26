import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CANAL_LABEL, CANAIS_VENDA } from "./vendas";

// O lançamento de venda no Financeiro leva o nome do canal escrito pelo banco
// (canal_venda_nome, VND-40). A tela usa CANAL_LABEL: os dois têm de bater.
const MIGRATION = path.resolve(
  __dirname,
  "../../supabase/migrations/20261026200000_venda_nome_do_canal.sql",
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
