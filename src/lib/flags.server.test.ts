import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

// A decisão em si (decidirFlag) já tem teste próprio em flags-regra.test.ts.
// Aqui o assunto é a cola do servidor: qual linha lê, que bucket passa e o
// que faz quando o banco cai.
const regra = vi.hoisted(() => ({
  bucketDaUsuaria: vi.fn(),
  decidirFlag: vi.fn(),
}));
vi.mock("@/lib/flags-regra", () => regra);

import { flagAtivaServidor } from "./flags.server";

const METODOS = ["select", "eq", "maybeSingle"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const flag = { estado: "on", rollout_pct: 50, beta_user_ids: [] };

beforeEach(() => {
  from.mockReset();
  regra.bucketDaUsuaria.mockReset();
  regra.decidirFlag.mockReset();
  delete process.env.FOUNDER_AMBIENTE;
});

afterEach(() => {
  delete process.env.FOUNDER_AMBIENTE;
});

describe("flagAtivaServidor", () => {
  it("lê a flag pela key no ambiente prod por padrão e passa o bucket da usuária", async () => {
    const q = consulta({ data: flag });
    from.mockReturnValueOnce(q);
    regra.bucketDaUsuaria.mockResolvedValue(42);
    regra.decidirFlag.mockReturnValue(true);

    expect(await flagAtivaServidor("ia_planejamento", "u-1")).toBe(true);
    expect(from).toHaveBeenCalledWith("founder_flags");
    expect(q.eq).toHaveBeenCalledWith("key", "ia_planejamento");
    expect(q.eq).toHaveBeenCalledWith("ambiente", "prod");
    expect(regra.bucketDaUsuaria).toHaveBeenCalledWith("u-1", "ia_planejamento");
    expect(regra.decidirFlag).toHaveBeenCalledWith(flag, "u-1", 42, true);
  });

  it("FOUNDER_AMBIENTE=preview lê a linha de preview", async () => {
    process.env.FOUNDER_AMBIENTE = "preview";
    const q = consulta({ data: null });
    from.mockReturnValueOnce(q);
    regra.decidirFlag.mockReturnValue(false);
    await flagAtivaServidor("x", null, false);
    expect(q.eq).toHaveBeenCalledWith("ambiente", "preview");
  });

  it("sem usuária não calcula bucket (passa null) e repassa o padrão", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    regra.decidirFlag.mockReturnValue(false);
    expect(await flagAtivaServidor("csat_modal", null, false)).toBe(false);
    expect(regra.bucketDaUsuaria).not.toHaveBeenCalled();
    expect(regra.decidirFlag).toHaveBeenCalledWith(null, null, null, false);
  });

  it("banco fora do ar devolve o padrão em vez de derrubar a ação", async () => {
    from.mockImplementationOnce(() => {
      throw new Error("db");
    });
    expect(await flagAtivaServidor("ia_planejamento", "u-1")).toBe(true);
    from.mockReturnValueOnce(consulta(Promise.reject(new Error("timeout"))));
    expect(await flagAtivaServidor("csat_modal", "u-1", false)).toBe(false);
  });
});
