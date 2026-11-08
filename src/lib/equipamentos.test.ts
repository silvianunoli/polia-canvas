import { describe, expect, it } from "vitest";
import {
  erroDoValor,
  erroDosMeses,
  reservaDoEquipamento,
  resumoEquipamentos,
  type Equipamento,
} from "./equipamentos";

const equip = (extra: Partial<Equipamento> = {}): Equipamento => ({
  id: "e1",
  nome: "Prensa",
  valor: 1359,
  mesesUso: 36,
  lancamentoId: null,
  compradoEm: null,
  ...extra,
});

describe("reservaDoEquipamento", () => {
  it("divide o preço pelos meses de uso", () => {
    expect(reservaDoEquipamento(equip({ valor: 3600, mesesUso: 36 }))).toBe(100);
  });

  it("sem meses não divide por zero", () => {
    expect(reservaDoEquipamento(equip({ mesesUso: 0 }))).toBe(0);
  });
});

describe("resumoEquipamentos", () => {
  it("lista vazia zera tudo", () => {
    expect(resumoEquipamentos([])).toEqual({ investido: 0, faltaComprar: 0, reservaDoMes: 0 });
  });

  it("separa o comprado do planejado e reserva pelos dois", () => {
    const r = resumoEquipamentos([
      equip({ id: "a", valor: 844.55, lancamentoId: "l1", compradoEm: "2026-11-08" }),
      equip({ id: "b", valor: 385.59 }),
      equip({ id: "c", valor: 1359 }),
      equip({ id: "d", valor: 60 }),
    ]);
    expect(r).toEqual({ investido: 844.55, faltaComprar: 1804.59, reservaDoMes: 73.59 });
  });

  it("arredonda a reserva depois de somar, não item a item", () => {
    const r = resumoEquipamentos([
      equip({ id: "a", valor: 1, mesesUso: 3 }),
      equip({ id: "b", valor: 1, mesesUso: 3 }),
      equip({ id: "c", valor: 1, mesesUso: 3 }),
    ]);
    expect(r.reservaDoMes).toBe(1);
  });
});

describe("validação", () => {
  it("preço precisa ser positivo e dentro do teto", () => {
    expect(erroDoValor(10)).toBeUndefined();
    expect(erroDoValor(0)).toBeDefined();
    expect(erroDoValor(Number.NaN)).toBeDefined();
    expect(erroDoValor(1_000_001)).toBeDefined();
  });

  it("meses é inteiro de 1 a 240", () => {
    expect(erroDosMeses(36)).toBeUndefined();
    expect(erroDosMeses(0)).toBeDefined();
    expect(erroDosMeses(1.5)).toBeDefined();
    expect(erroDosMeses(241)).toBeDefined();
    expect(erroDosMeses(Number.NaN)).toBeDefined();
  });
});
