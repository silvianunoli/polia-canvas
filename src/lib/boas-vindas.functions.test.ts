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

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));

const { enviarEmailResend } = vi.hoisted(() => ({ enviarEmailResend: vi.fn() }));
vi.mock("@/lib/email-template", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email-template")>()),
  enviarEmailResend,
}));

import { garantirBoasVindas } from "./boas-vindas.functions";

type Chamavel = (opts?: { context?: unknown }) => Promise<unknown>;
const garantir = garantirBoasVindas as unknown as Chamavel;

const METODOS = ["select", "eq", "maybeSingle", "update"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const context = { userId: "u-1", claims: { email: "ana@exemplo.com" } };

beforeEach(() => {
  from.mockReset();
  enviarEmailResend.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("garantirBoasVindas: idempotência", () => {
  it("perfil já marcado não recebe o e-mail de novo", async () => {
    from.mockReturnValueOnce(
      consulta({ data: { boas_vindas_enviado_em: "2026-09-01T00:00:00Z" } }),
    );
    expect(await garantir({ context })).toEqual({ ok: true });
    expect(enviarEmailResend).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("sem perfil não manda nada (conta ainda não existe de verdade)", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    expect(await garantir({ context })).toEqual({ ok: true });
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("sem e-mail nas claims devolve ok false sem tentar enviar", async () => {
    from.mockReturnValueOnce(consulta({ data: { boas_vindas_enviado_em: null } }));
    expect(await garantir({ context: { userId: "u-1", claims: {} } })).toEqual({ ok: false });
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });
});

describe("garantirBoasVindas: regra do 'só marca com envio confirmado'", () => {
  it("falha no envio NÃO marca boas_vindas_enviado_em (permite o retry no próximo load)", async () => {
    from.mockReturnValueOnce(consulta({ data: { boas_vindas_enviado_em: null } }));
    enviarEmailResend.mockResolvedValue(false);

    expect(await garantir({ context })).toEqual({ ok: false });
    // Só a leitura do perfil aconteceu; nenhum update.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("envio confirmado marca o timestamp no perfil dela", async () => {
    from.mockReturnValueOnce(consulta({ data: { boas_vindas_enviado_em: null } }));
    const update = consulta({ error: null });
    from.mockReturnValueOnce(update);
    enviarEmailResend.mockResolvedValue(true);

    expect(await garantir({ context })).toEqual({ ok: true });
    expect(enviarEmailResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["ana@exemplo.com"],
        subject: "Bem-vinda à Pólia One",
        contexto: "[BoasVindas]",
      }),
    );
    const { text, html } = enviarEmailResend.mock.calls[0][0] as { text: string; html: string };
    expect(text).toContain("https://one.usepolia.com.br/painel");
    expect(html).toContain("https://one.usepolia.com.br/painel");

    expect(from).toHaveBeenLastCalledWith("profiles");
    expect(update.update).toHaveBeenCalledWith({ boas_vindas_enviado_em: expect.any(String) });
    expect(update.eq).toHaveBeenCalledWith("id", "u-1");
  });

  it("falha ao marcar depois do envio não vira erro pra tela (o e-mail já saiu)", async () => {
    from.mockReturnValueOnce(consulta({ data: { boas_vindas_enviado_em: null } }));
    from.mockReturnValueOnce(consulta({ error: { message: "db" } }));
    enviarEmailResend.mockResolvedValue(true);
    expect(await garantir({ context })).toEqual({ ok: true });
  });
});
