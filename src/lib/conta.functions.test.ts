import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: (i: unknown) => unknown = (i) => i;
    const builder = {
      inputValidator(v: (i: unknown) => unknown) {
        validator = v;
        return builder;
      },
      middleware() {
        return builder;
      },
      handler(fn: (ctx: { data: unknown; context: unknown }) => unknown) {
        return async (opts?: { data?: unknown; context?: unknown }) =>
          fn({ data: validator(opts?.data), context: opts?.context });
      },
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const { from, deleteUser } = vi.hoisted(() => ({ from: vi.fn(), deleteUser: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from, auth: { admin: { deleteUser } } },
}));

const { cancel } = vi.hoisted(() => ({ cancel: vi.fn() }));
vi.mock("@/lib/stripe.functions", () => ({
  stripeClient: () => ({ subscriptions: { cancel } }),
}));

import { excluirMinhaConta } from "./conta.functions";

type Chamavel = (opts?: { context?: unknown }) => Promise<unknown>;
const excluir = excluirMinhaConta as unknown as Chamavel;

const METODOS = ["select", "eq", "maybeSingle", "insert"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const rpc = vi.fn();
const context = { userId: "u-1", supabase: { rpc } };

// A 1ª leitura é sempre a assinatura; erros_app só entra quando algo falha.
function assinatura(row: unknown) {
  from.mockReturnValueOnce(consulta({ data: row }));
}
function errosApp() {
  const q = consulta({ error: null });
  from.mockReturnValueOnce(q);
  return q;
}

beforeEach(() => {
  from.mockReset();
  deleteUser.mockReset();
  cancel.mockReset();
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("excluirMinhaConta: caminho feliz", () => {
  it("sem assinatura ativa não fala com o Stripe: apaga dados e depois o login", async () => {
    assinatura(null);
    rpc.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });

    expect(await excluir({ context })).toEqual({ ok: true, error: null });
    expect(cancel).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("excluir_dados_do_usuario");
    expect(deleteUser).toHaveBeenCalledWith("u-1");
    // Dados primeiro, login depois: se o Auth falhar, sobra só a casca.
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0]);
  });

  it("assinatura já cancelada no Stripe não é cancelada de novo", async () => {
    assinatura({ stripe_subscription_id: "sub_1", status: "canceled" });
    rpc.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    expect(await excluir({ context })).toEqual({ ok: true, error: null });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("assinatura ativa é cancelada ANTES de apagar qualquer coisa", async () => {
    assinatura({ stripe_subscription_id: "sub_1", status: "active" });
    cancel.mockResolvedValue({});
    rpc.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });

    expect(await excluir({ context })).toEqual({ ok: true, error: null });
    expect(cancel).toHaveBeenCalledWith("sub_1");
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
  });
});

describe("excluirMinhaConta: falhas", () => {
  it("Stripe recusa o cancelamento: aborta sem apagar nada (cobrança não pode ficar viva)", async () => {
    assinatura({ stripe_subscription_id: "sub_1", status: "past_due" });
    cancel.mockRejectedValue(new Error("stripe down"));
    const log = errosApp();

    const r = (await excluir({ context })) as { ok: boolean; error: string };
    expect(r.ok).toBe(false);
    expect(r.error).toContain("cancelar sua assinatura");
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();

    expect(from).toHaveBeenCalledWith("erros_app");
    expect(log.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        origem: "server",
        pagina: "/configuracoes",
        user_id: "u-1",
        mensagem: expect.stringContaining("cancelamento da assinatura no Stripe: stripe down"),
      }),
    );
  });

  it("RPC falha: registra o SQLSTATE em erros_app e não remove o login", async () => {
    assinatura(null);
    rpc.mockResolvedValue({
      error: { code: "23502", message: "null value", details: null, hint: "x" },
    });
    const log = errosApp();

    const r = (await excluir({ context })) as { ok: boolean; error: string };
    expect(r.ok).toBe(false);
    expect(r.error).toContain("apagar seus dados");
    expect(deleteUser).not.toHaveBeenCalled();
    // O código do Postgres é o que aponta o conserto; precisa sobreviver no log.
    expect(log.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u-1",
        mensagem: expect.stringContaining("excluir_dados_do_usuario: 23502 | null value | x"),
      }),
    );
  });

  it("Auth falha depois dos dados apagados: devolve ok false contando as duas metades", async () => {
    assinatura(null);
    rpc.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: { message: "fk founder_alertas" } });
    const log = errosApp();

    const r = (await excluir({ context })) as { ok: boolean; error: string };
    // Até 17/09 isto voltava ok: true e deixava uma casca de login órfã.
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Seus dados foram apagados");
    // user_id nulo de propósito: o perfil já não existe (FK) e ela pediu esquecimento.
    expect(log.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        mensagem: expect.stringContaining("auth.admin.deleteUser: fk founder_alertas"),
      }),
    );
  });

  it("falha ao gravar em erros_app nunca vira exceção nova", async () => {
    assinatura(null);
    rpc.mockResolvedValue({ error: { code: "42P01", message: "tabela sumiu" } });
    from.mockReturnValueOnce(consulta(Promise.reject(new Error("erros_app fora do ar"))));

    const r = (await excluir({ context })) as { ok: boolean };
    expect(r.ok).toBe(false);
  });
});
