import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";

import type { CalculadoraBreakdown } from "@/lib/precificacao.functions";

// "Banco" de mentira: o que foi inserido e atualizado em produtos.
const banco = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  updates: [] as { id: string; campos: Record<string, unknown> }[],
  erroInsert: null as { message: string } | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (linha: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (banco.erroInsert) return { data: null, error: banco.erroInsert };
            banco.inserts.push(linha);
            return { data: { id: "p1" }, error: null };
          },
        }),
      }),
      update: (campos: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          banco.updates.push({ id, campos });
          return { error: null };
        },
      }),
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/founder-eventos", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/ativacaoPreco", () => ({ avisarAtivacaoNoGA: vi.fn() }));

const { useGuardarPrimeiroPreco } = await import("./useGuardarPrimeiroPreco");
const { registrar } = await import("@/lib/founder-eventos");

const bk = (margem: string): CalculadoraBreakdown => ({
  perfil: "produto",
  valores: { materiaPrima: "5", margem },
});

type Props = { ativo: boolean; pronto: boolean; preco: number; margem: string };

function montar(inicial: Props, onCriado = vi.fn()) {
  return renderHook(
    (p: Props) =>
      useGuardarPrimeiroPreco({
        userId: "u1",
        ativo: p.ativo,
        pronto: p.pronto,
        valores: {
          perfil: "produto",
          precoVenda: p.preco,
          precoCusto: 5,
          breakdown: bk(p.margem),
        },
        onCriado,
      }),
    { initialProps: inicial },
  );
}

async function passar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useGuardarPrimeiroPreco (GRW-90)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    banco.inserts = [];
    banco.updates = [];
    banco.erroInsert = null;
    vi.mocked(registrar).mockClear();
  });

  it("espera a conta parar 2 s e só então guarda, com o nome provisório", async () => {
    const onCriado = vi.fn();
    const { result } = montar({ ativo: true, pronto: true, preco: 10, margem: "20" }, onCriado);
    await passar(1900);
    expect(banco.inserts).toHaveLength(0);
    await passar(200);
    expect(banco.inserts).toHaveLength(1);
    expect(banco.inserts[0]).toMatchObject({
      user_id: "u1",
      nome: "Primeiro produto",
      tipo: "fisico",
      preco_venda: 10,
      preco_custo: 5,
    });
    expect(result.current.estado).toBe("guardado");
    expect(result.current.produtoId).toBe("p1");
    expect(onCriado).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledWith("create_product", {
      feature: "calculadora",
      propriedades: { tipo: "fisico", auto: true },
    });
  });

  it("digitação no meio reinicia a espera: um insert só, com o último valor", async () => {
    const { rerender } = montar({ ativo: true, pronto: true, preco: 10, margem: "20" });
    await passar(1500);
    rerender({ ativo: true, pronto: true, preco: 12, margem: "30" });
    await passar(1500);
    expect(banco.inserts).toHaveLength(0);
    await passar(600);
    expect(banco.inserts).toHaveLength(1);
    expect(banco.inserts[0]).toMatchObject({ preco_venda: 12 });
  });

  it("depois de guardado, resultado novo atualiza a mesma linha, mesmo com ativo false", async () => {
    const { rerender } = montar({ ativo: true, pronto: true, preco: 10, margem: "20" });
    await passar(2100);
    // A releitura de "tem preço" já vê o produto: ativo vira false.
    rerender({ ativo: false, pronto: true, preco: 15, margem: "40" });
    await passar(2100);
    expect(banco.inserts).toHaveLength(1);
    expect(banco.updates).toHaveLength(1);
    expect(banco.updates[0]).toMatchObject({ id: "p1", campos: { preco_venda: 15 } });
  });

  it("não grava sem o resultado pronto nem fora da regra", async () => {
    montar({ ativo: true, pronto: false, preco: 10, margem: "20" });
    await passar(5000);
    cleanup();
    montar({ ativo: false, pronto: true, preco: 10, margem: "20" });
    await passar(5000);
    expect(banco.inserts).toHaveLength(0);
  });

  it("sair da tela no meio da espera grava na hora", async () => {
    const { unmount } = montar({ ativo: true, pronto: true, preco: 10, margem: "20" });
    await passar(500);
    unmount();
    await passar(0);
    expect(banco.inserts).toHaveLength(1);
  });

  it("resultado que fica inválido cancela a espera e sair da tela não grava", async () => {
    const { rerender, unmount } = montar({ ativo: true, pronto: true, preco: 10, margem: "20" });
    await passar(500);
    rerender({ ativo: true, pronto: false, preco: 0, margem: "120" });
    unmount();
    await passar(3000);
    expect(banco.inserts).toHaveLength(0);
  });

  it("erro de cota vira recado próprio e Tentar de novo grava de novo", async () => {
    banco.erroInsert = { message: "Limite do plano Grátis atingido (5 produtos)." };
    const { result } = montar({ ativo: true, pronto: true, preco: 10, margem: "20" });
    await passar(2100);
    expect(result.current.estado).toBe("erro");
    expect(result.current.erro).toMatch(/catálogo do plano Grátis já está cheio/);
    banco.erroInsert = null;
    await act(async () => {
      result.current.tentarDeNovo();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(banco.inserts).toHaveLength(1);
    expect(result.current.estado).toBe("guardado");
  });

  it("trocar o nome atualiza só o nome do produto guardado", async () => {
    const { result } = montar({ ativo: true, pronto: true, preco: 10, margem: "20" });
    await passar(2100);
    act(() => result.current.setNome("  Bolo de pote "));
    let ok = false;
    await act(async () => {
      ok = await result.current.salvarNome();
    });
    expect(ok).toBe(true);
    expect(banco.updates.at(-1)).toMatchObject({ id: "p1", campos: { nome: "Bolo de pote" } });
    expect(banco.updates.at(-1)?.campos).not.toHaveProperty("preco_venda");
  });
});
