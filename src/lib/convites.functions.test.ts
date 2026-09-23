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

const { logAcaoAdminServer } = vi.hoisted(() => ({ logAcaoAdminServer: vi.fn() }));
vi.mock("@/lib/audit-log.server", () => ({ logAcaoAdminServer }));

const { enviarEmailResend } = vi.hoisted(() => ({ enviarEmailResend: vi.fn() }));
vi.mock("@/lib/email-template", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email-template")>()),
  enviarEmailResend,
}));

import {
  verificarConvite,
  listarConvites,
  criarConvite,
  enviarConvite,
  removerConvite,
} from "./convites.functions";

type Chamavel = (opts?: { data?: unknown; context?: unknown }) => Promise<unknown>;
const verificar = verificarConvite as unknown as Chamavel;
const listar = listarConvites as unknown as Chamavel;
const criar = criarConvite as unknown as Chamavel;
const enviar = enviarConvite as unknown as Chamavel;
const remover = removerConvite as unknown as Chamavel;

const METODOS = ["select", "eq", "order", "maybeSingle", "insert", "update", "delete"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const admin = { userId: "admin-1" };
const comum = { userId: "comum-1" };

// Primeira consulta de toda função admin é o profiles.is_admin.
function perfil(isAdmin: boolean) {
  from.mockReturnValueOnce(consulta({ data: { is_admin: isAdmin } }));
}

beforeEach(() => {
  from.mockReset();
  logAcaoAdminServer.mockReset();
  enviarEmailResend.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("verificarConvite (pública, usada no cadastro)", () => {
  it("normaliza o e-mail (trim + minúsculas) antes de procurar", async () => {
    const q = consulta({ data: null });
    from.mockReturnValueOnce(q);
    await verificar({ data: { email: "  Ana@Exemplo.COM " } });
    expect(from).toHaveBeenCalledWith("convites_cadastro");
    expect(q.eq).toHaveBeenCalledWith("email", "ana@exemplo.com");
  });

  it("e-mail inválido rejeita sem consultar", async () => {
    await expect(verificar({ data: { email: "x" } })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("sem convite bloqueia; convite não usado libera; convite usado bloqueia", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    expect(await verificar({ data: { email: "a@b.co" } })).toEqual({ permitido: false });

    from.mockReturnValueOnce(consulta({ data: { usado_em: null } }));
    expect(await verificar({ data: { email: "a@b.co" } })).toEqual({ permitido: true });

    from.mockReturnValueOnce(consulta({ data: { usado_em: "2026-09-01T00:00:00Z" } }));
    expect(await verificar({ data: { email: "a@b.co" } })).toEqual({ permitido: false });
  });
});

describe("listarConvites", () => {
  it("só admin lista: quem não é admin recebe Forbidden sem tocar na tabela", async () => {
    perfil(false);
    await expect(listar({ context: comum })).rejects.toThrow("Forbidden");
    // Uma chamada só: a do profiles. A tabela de convites nunca foi lida.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("profiles");
  });

  it("perfil inexistente também é Forbidden (não assume admin por ausência)", async () => {
    from.mockReturnValueOnce(consulta({ data: null }));
    await expect(listar({ context: comum })).rejects.toThrow("Forbidden");
  });

  it("admin recebe a lista do mais recente pro mais antigo", async () => {
    perfil(true);
    const q = consulta({ data: [{ email: "a@b.co" }], error: null });
    from.mockReturnValueOnce(q);
    expect(await listar({ context: admin })).toEqual({ convites: [{ email: "a@b.co" }] });
    expect(q.order).toHaveBeenCalledWith("criado_em", { ascending: false });
  });

  it("erro do banco vira exceção com mensagem própria", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: null, error: { message: "x" } }));
    await expect(listar({ context: admin })).rejects.toThrow("Falha ao listar convites.");
  });
});

describe("criarConvite", () => {
  it("não-admin não cria", async () => {
    perfil(false);
    await expect(criar({ data: { email: "a@b.co" }, context: comum })).rejects.toThrow("Forbidden");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("insere o e-mail normalizado e registra na auditoria", async () => {
    perfil(true);
    const q = consulta({ error: null });
    from.mockReturnValueOnce(q);
    expect(await criar({ data: { email: " Nova@Exemplo.com " }, context: admin })).toEqual({
      ok: true,
    });
    expect(q.insert).toHaveBeenCalledWith({ email: "nova@exemplo.com" });
    expect(logAcaoAdminServer).toHaveBeenCalledWith("admin-1", "criar_convite", "nova@exemplo.com");
  });

  it("e-mail já convidado (23505) tem mensagem própria e não vai pra auditoria", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ error: { code: "23505" } }));
    await expect(criar({ data: { email: "a@b.co" }, context: admin })).rejects.toThrow(
      "Esse e-mail já tem convite.",
    );
    expect(logAcaoAdminServer).not.toHaveBeenCalled();
  });

  it("outro erro do banco vira falha genérica", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ error: { code: "42P01" } }));
    await expect(criar({ data: { email: "a@b.co" }, context: admin })).rejects.toThrow(
      "Falha ao criar convite.",
    );
  });
});

describe("enviarConvite", () => {
  it("e-mail fora da lista não recebe convite", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: null }));
    await expect(enviar({ data: { email: "a@b.co" }, context: admin })).rejects.toThrow(
      "Esse e-mail não está na lista de convites.",
    );
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("quem já criou a conta não recebe reenvio", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: { usado_em: "2026-09-01T00:00:00Z" } }));
    await expect(enviar({ data: { email: "a@b.co" }, context: admin })).rejects.toThrow(
      "Essa pessoa já criou a conta, não precisa reenviar.",
    );
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("falha do Resend NÃO marca enviado_em nem vai pra auditoria", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: { usado_em: null } }));
    enviarEmailResend.mockResolvedValue(false);
    await expect(enviar({ data: { email: "a@b.co" }, context: admin })).rejects.toThrow(
      "Não conseguimos enviar o convite agora. Tenta de novo.",
    );
    // profiles + select do convite; o update de enviado_em nunca acontece.
    expect(from).toHaveBeenCalledTimes(2);
    expect(logAcaoAdminServer).not.toHaveBeenCalled();
  });

  it("envio confirmado manda o link de cadastro com o e-mail e marca enviado_em", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: { usado_em: null } }));
    const update = consulta({ error: null });
    from.mockReturnValueOnce(update);
    enviarEmailResend.mockResolvedValue(true);

    expect(await enviar({ data: { email: "Ana+x@Exemplo.com" }, context: admin })).toEqual({
      ok: true,
    });

    const chamada = enviarEmailResend.mock.calls[0][0] as {
      to: string[];
      text: string;
      html: string;
      contexto: string;
    };
    expect(chamada.to).toEqual(["ana+x@exemplo.com"]);
    const link = "https://one.usepolia.com.br/auth/cadastro?email=ana%2Bx%40exemplo.com";
    expect(chamada.text).toContain(link);
    expect(chamada.html).toContain(link);
    expect(chamada.contexto).toBe("[Convites]");

    expect(update.update).toHaveBeenCalledWith({ enviado_em: expect.any(String) });
    expect(update.eq).toHaveBeenCalledWith("email", "ana+x@exemplo.com");
    expect(logAcaoAdminServer).toHaveBeenCalledWith(
      "admin-1",
      "enviar_convite",
      "ana+x@exemplo.com",
    );
  });

  it("falha ao marcar enviado_em não desfaz o envio (só loga)", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ data: { usado_em: null } }));
    from.mockReturnValueOnce(consulta({ error: { message: "db" } }));
    enviarEmailResend.mockResolvedValue(true);
    expect(await enviar({ data: { email: "a@b.co" }, context: admin })).toEqual({ ok: true });
  });
});

describe("removerConvite", () => {
  it("apaga pelo e-mail normalizado e audita", async () => {
    perfil(true);
    const q = consulta({ error: null });
    from.mockReturnValueOnce(q);
    expect(await remover({ data: { email: "A@B.co" }, context: admin })).toEqual({ ok: true });
    expect(q.delete).toHaveBeenCalled();
    expect(q.eq).toHaveBeenCalledWith("email", "a@b.co");
    expect(logAcaoAdminServer).toHaveBeenCalledWith("admin-1", "remover_convite", "a@b.co");
  });

  it("erro do banco vira exceção e não audita", async () => {
    perfil(true);
    from.mockReturnValueOnce(consulta({ error: { message: "x" } }));
    await expect(remover({ data: { email: "a@b.co" }, context: admin })).rejects.toThrow(
      "Falha ao remover convite.",
    );
    expect(logAcaoAdminServer).not.toHaveBeenCalled();
  });
});
