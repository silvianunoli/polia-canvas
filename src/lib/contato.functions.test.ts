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

const { enviarEmailResend } = vi.hoisted(() => ({ enviarEmailResend: vi.fn() }));
vi.mock("@/lib/email-template", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email-template")>()),
  enviarEmailResend,
}));

import { enviarContato } from "./contato.functions";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const enviar = enviarContato as unknown as Chamavel;

type Consulta = { insert: Mock<(...args: unknown[]) => Consulta> } & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  q.insert = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const valido = {
  nome: "Ana",
  email: "ana@exemplo.com",
  assunto: "Dúvida",
  mensagem: "Quero saber do plano Premium.",
  turnstileToken: "tok",
};

beforeEach(() => {
  from.mockReset();
  verificarTurnstileServer.mockReset();
  enviarEmailResend.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("enviarContato: validação", () => {
  it("mensagem curta demais ou assunto vazio rejeitam antes de tudo", async () => {
    await expect(enviar({ data: { ...valido, mensagem: "oi" } })).rejects.toThrow();
    await expect(enviar({ data: { ...valido, assunto: "  " } })).rejects.toThrow();
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("enviarContato: gates anti-abuso", () => {
  it("honeypot preenchido finge sucesso sem gravar nem notificar", async () => {
    expect(await enviar({ data: { ...valido, hp: "x" } })).toEqual({ ok: true });
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("Turnstile reprovado bloqueia sem gravar nem notificar", async () => {
    verificarTurnstileServer.mockResolvedValue(false);
    expect(await enviar({ data: valido })).toEqual({ ok: false });
    expect(from).not.toHaveBeenCalled();
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });
});

describe("enviarContato: gravação e notificação", () => {
  beforeEach(() => verificarTurnstileServer.mockResolvedValue(true));

  it("grava o contato e avisa oi@usepolia.com.br com reply-to da pessoa", async () => {
    const q = consulta({ error: null });
    from.mockReturnValueOnce(q);

    expect(await enviar({ data: { ...valido, telefone: "11 98888-7777" } })).toEqual({ ok: true });

    expect(from).toHaveBeenCalledWith("contatos");
    expect(q.insert).toHaveBeenCalledWith({
      nome: "Ana",
      email: "ana@exemplo.com",
      telefone: "5511988887777",
      assunto: "Dúvida",
      mensagem: "Quero saber do plano Premium.",
    });
    expect(enviarEmailResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["oi@usepolia.com.br"],
        replyTo: "ana@exemplo.com",
        subject: "[Contato] Dúvida · Ana",
        contexto: "[Contato]",
      }),
    );
  });

  it("escapa HTML da mensagem no e-mail (XSS corrigido em jul/2026)", async () => {
    from.mockReturnValueOnce(consulta({ error: null }));
    await enviar({
      data: { ...valido, nome: "<b>Ana</b>", mensagem: "<script>alert(1)</script> linha\nnova" },
    });
    const { html } = enviarEmailResend.mock.calls[0][0] as { html: string };
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).toContain("linha<br />nova");
  });

  it("falha ao gravar devolve ok false e NÃO manda e-mail", async () => {
    from.mockReturnValueOnce(consulta({ error: { code: "42P01" } }));
    expect(await enviar({ data: valido })).toEqual({ ok: false });
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("falha do Resend não derruba a resposta: o contato já está salvo", async () => {
    from.mockReturnValueOnce(consulta({ error: null }));
    enviarEmailResend.mockResolvedValue(false);
    expect(await enviar({ data: valido })).toEqual({ ok: true });
  });
});
