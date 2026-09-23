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

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

const { verificarTurnstileServer } = vi.hoisted(() => ({ verificarTurnstileServer: vi.fn() }));
vi.mock("@/lib/turnstile.server", () => ({ verificarTurnstileServer }));

import { entrarListaEspera } from "./lista-espera.functions";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const entrar = entrarListaEspera as unknown as Chamavel;

type Consulta = { insert: Mock<(...args: unknown[]) => Consulta> } & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  q.insert = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const valido = {
  nome: "Ana",
  email: "Ana@Exemplo.com",
  turnstileToken: "tok",
  novidades: true,
};

beforeEach(() => {
  from.mockReset();
  verificarTurnstileServer.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("entrarListaEspera: validação", () => {
  it("nome curto ou e-mail inválido rejeitam antes do Turnstile e do banco", async () => {
    await expect(entrar({ data: { ...valido, nome: "A" } })).rejects.toThrow();
    await expect(entrar({ data: { ...valido, email: "sem-arroba" } })).rejects.toThrow();
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("entrarListaEspera: gates anti-abuso", () => {
  it("honeypot preenchido finge sucesso sem gravar nem validar Turnstile", async () => {
    const r = await entrar({ data: { ...valido, hp: "bot" } });
    expect(r).toEqual({ ok: true, jaEstava: false });
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("Turnstile reprovado bloqueia sem gravar nada", async () => {
    verificarTurnstileServer.mockResolvedValue(false);
    const r = await entrar({ data: valido });
    expect(r).toEqual({ ok: false, jaEstava: false });
    expect(verificarTurnstileServer).toHaveBeenCalledWith("tok");
    expect(from).not.toHaveBeenCalled();
  });
});

describe("entrarListaEspera: gravação", () => {
  beforeEach(() => verificarTurnstileServer.mockResolvedValue(true));

  it("grava e-mail em minúsculas, telefone normalizado e devolve eventId novo", async () => {
    const q = consulta({ error: null });
    from.mockReturnValueOnce(q);
    const r = (await entrar({
      data: { ...valido, telefone: "(11) 99999-8888", tipo_negocio: " doces " },
    })) as { ok: boolean; jaEstava: boolean; eventId?: string };

    expect(from).toHaveBeenCalledWith("lista_espera");
    expect(q.insert).toHaveBeenCalledWith({
      nome: "Ana",
      email: "ana@exemplo.com",
      tipo_negocio: "doces",
      telefone: "5511999998888",
      novidades: true,
    });
    expect(r.ok).toBe(true);
    expect(r.jaEstava).toBe(false);
    // eventId é o que dispara o Lead do Meta Pixel: só em inscrição nova.
    expect(r.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sem telefone e sem tipo de negócio grava null (campos opcionais)", async () => {
    const q = consulta({ error: null });
    from.mockReturnValueOnce(q);
    await entrar({ data: { nome: "Ana", email: "a@b.co", turnstileToken: "tok" } });
    expect(q.insert).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: null, tipo_negocio: null, novidades: false }),
    );
  });

  it("e-mail duplicado (23505) é sucesso pra usuária, sem eventId", async () => {
    from.mockReturnValueOnce(consulta({ error: { code: "23505" } }));
    const r = await entrar({ data: valido });
    expect(r).toEqual({ ok: true, jaEstava: true });
  });

  it("outro erro do banco devolve ok false sem eventId", async () => {
    from.mockReturnValueOnce(consulta({ error: { code: "42P01" } }));
    expect(await entrar({ data: valido })).toEqual({ ok: false, jaEstava: false });
  });
});
