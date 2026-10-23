import { describe, expect, it } from "vitest";
import { contaEmPeca, diasDeHistorico, sugerirReposicao, type ItemParaRepor } from "./reposicao";

const item = (chave: string, extra: Partial<ItemParaRepor> = {}): ItemParaRepor => ({
  chave,
  nome: chave,
  saldo: 10,
  minimo: 0,
  saiu: 0,
  dias: 60,
  ...extra,
});

describe("sugerirReposicao", () => {
  it("repõe o que sai no prazo, mais o mínimo, menos o que tem", () => {
    // 60 em 60 dias = 1 por dia; 30 dias + mínimo 5 = 35; tem 10 → 25.
    const [s] = sugerirReposicao([item("vela", { saiu: 60, minimo: 5 })], 30, { inteiro: true });
    expect(s.repor).toBe(25);
    expect(s.precisa).toBe(35);
    expect(s.porDia).toBe(1);
    expect(s.acabaEm).toBe(10);
    expect(s.urgente).toBe(false);
  });
  it("arredonda pra cima: peça inteira no produto, 3 casas no insumo", () => {
    const base = item("x", { saiu: 7, saldo: 0 }); // 7/60 por dia x 30 = 3,5
    expect(sugerirReposicao([base], 30, { inteiro: true })[0].repor).toBe(4);
    expect(sugerirReposicao([base], 30, { inteiro: false })[0].repor).toBe(3.5);
  });
  it("precisa ter arredonda antes de subtrair, e a unidade decide se é inteiro", () => {
    // 0,47 por dia x 30 = 14,2 → precisa de 15; tem 3,4 → faltam 11,6.
    const base = item("fita", { saiu: 28.4, saldo: 3.4 });
    const [peca] = sugerirReposicao([base], 30, { inteiro: (c) => c === "fita" });
    expect([peca.precisa, peca.repor]).toEqual([15, 11.6]);
    expect(peca.precisa - peca.saldo).toBeCloseTo(peca.repor, 9);
  });
  it("saldo negativo entra na conta e item parado acima do mínimo fica de fora", () => {
    const lista = sugerirReposicao(
      [item("devendo", { saldo: -3, minimo: 2 }), item("parado", { saldo: 50 })],
      30,
      { inteiro: true },
    );
    expect(lista.map((s) => [s.chave, s.repor])).toEqual([["devendo", 5]]);
    expect(lista[0].urgente).toBe(true);
    expect(lista[0].acabaEm).toBeNull();
  });
  it("quem acaba antes vem primeiro, urgente na frente", () => {
    const lista = sugerirReposicao(
      [
        item("devagar", { saiu: 30, saldo: 20 }), // acaba em 40 dias
        item("rapido", { saiu: 120, saldo: 10 }), // acaba em 5 dias
        item("medio", { saiu: 60, saldo: 15 }), // acaba em 15 dias
      ],
      60,
      { inteiro: true },
    );
    expect(lista.map((s) => s.chave)).toEqual(["rapido", "medio", "devagar"]);
    expect(lista[0].urgente).toBe(true);
  });
  it("com estoque que cobre o prazo, não sugere nada", () => {
    expect(sugerirReposicao([item("ok", { saiu: 60, saldo: 40 })], 30, { inteiro: true })).toEqual(
      [],
    );
  });
});

describe("diasDeHistorico", () => {
  it("usa a idade do cadastro, entre 7 e 60 dias", () => {
    expect(diasDeHistorico("2026-10-13T15:00:00Z", "2026-10-23")).toBe(10);
    expect(diasDeHistorico("2026-10-22", "2026-10-23")).toBe(7);
    expect(diasDeHistorico("2025-01-01", "2026-10-23")).toBe(60);
    expect(diasDeHistorico(null, "2026-10-23")).toBe(60);
  });
});

describe("casos de borda", () => {
  it("saída negativa vira zero, e no mínimo exato sem saída não sugere nada", () => {
    expect(
      sugerirReposicao([item("a", { saiu: -5, saldo: 2, minimo: 2 })], 30, { inteiro: true }),
    ).toEqual([]);
  });
  it("o prazo muda o tanto, não o ritmo", () => {
    const base = [item("a", { saiu: 60, saldo: 0 })];
    expect(sugerirReposicao(base, 15, { inteiro: true })[0].repor).toBe(15);
    expect(sugerirReposicao(base, 60, { inteiro: true })[0].repor).toBe(60);
  });
  it("cadastro no futuro conta como o mínimo de 7 dias", () => {
    expect(diasDeHistorico("2026-12-01", "2026-10-23")).toBe(7);
  });
  it("unidade de peça compra inteiro", () => {
    expect(contaEmPeca("un")).toBe(true);
    expect(contaEmPeca(" Folhas ")).toBe(true);
    expect(contaEmPeca("g")).toBe(false);
    expect(contaEmPeca("kg")).toBe(false);
  });
});
