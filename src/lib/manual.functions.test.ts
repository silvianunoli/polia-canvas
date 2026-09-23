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

import { gravarLeadManual } from "./manual.functions";
import { CONSENT_TEXTO_MANUAL } from "./manual/conteudo";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const gravar = gravarLeadManual as unknown as Chamavel;

const METODOS = ["select", "eq", "maybeSingle", "upsert", "single"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const DOWNLOAD = "6b1f2c3d-1111-4222-8333-444455556666";
const DESCADASTRO = "7c2a3b4c-1111-4222-9333-444455556666";
const valido = { email: "Ana@Exemplo.com", consentimento: true, turnstileToken: "tok" };

// 1ª consulta: já existe lead com esse e-mail? 2ª: upsert devolvendo tokens.
function cenario(existente: unknown, upsertResultado: unknown) {
  from.mockReturnValueOnce(consulta({ data: existente }));
  const up = consulta(upsertResultado);
  from.mockReturnValueOnce(up);
  return up;
}

beforeEach(() => {
  from.mockReset();
  verificarTurnstileServer.mockReset();
  enviarEmailResend.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("gravarLeadManual: gates", () => {
  it("consentimento false rejeita antes de tudo", async () => {
    await expect(gravar({ data: { ...valido, consentimento: false } })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("honeypot recebe um link que não abre nada (token sem linha), sem gravar", async () => {
    const r = (await gravar({ data: { ...valido, hp: "bot" } })) as {
      ok: boolean;
      downloadUrl: string;
      eventId?: string;
    };
    expect(r.ok).toBe(true);
    expect(r.downloadUrl).toMatch(
      /^https:\/\/one\.usepolia\.com\.br\/manual\/baixar\?t=[0-9a-f-]{36}$/,
    );
    expect(r.eventId).toBeUndefined();
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("Turnstile reprovado devolve motivo turnstile sem gravar", async () => {
    verificarTurnstileServer.mockResolvedValue(false);
    expect(await gravar({ data: valido })).toEqual({ ok: false, motivo: "turnstile" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("gravarLeadManual: gravação", () => {
  beforeEach(() => verificarTurnstileServer.mockResolvedValue(true));

  it("lead novo: upsert por e-mail, e-mail com o link e eventId pro Pixel", async () => {
    const up = cenario(null, {
      data: { download_token: DOWNLOAD, descadastro_token: DESCADASTRO },
      error: null,
    });

    const r = (await gravar({ data: { ...valido, telefone: "(21) 98765-4321" } })) as {
      ok: boolean;
      downloadUrl: string;
      eventId?: string;
    };

    expect(from).toHaveBeenNthCalledWith(1, "manual_leads");
    expect(from).toHaveBeenNthCalledWith(2, "manual_leads");
    const [payload, opcoes] = up.upsert.mock.calls[0];
    expect(opcoes).toEqual({ onConflict: "email" });
    expect(payload).toEqual(
      expect.objectContaining({
        email: "ana@exemplo.com",
        origem: "instagram_bio",
        consentimento: true,
        consent_texto: CONSENT_TEXTO_MANUAL,
        descadastrado_em: null,
        telefone: "5521987654321",
      }),
    );
    expect(payload).not.toHaveProperty("download_token");
    expect(payload).not.toHaveProperty("descadastro_token");

    expect(r.ok).toBe(true);
    expect(r.downloadUrl).toBe(`https://one.usepolia.com.br/manual/baixar?t=${DOWNLOAD}`);
    expect(r.eventId).toMatch(/^[0-9a-f-]{36}$/);

    const descadastroUrl = `https://one.usepolia.com.br/descadastrar?t=${DESCADASTRO}`;
    expect(enviarEmailResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["ana@exemplo.com"],
        replyTo: "oi@usepolia.com.br",
        headers: { "List-Unsubscribe": `<${descadastroUrl}>` },
        contexto: "[Manual]",
      }),
    );
    const { html } = enviarEmailResend.mock.calls[0][0] as { html: string };
    expect(html).toContain(r.downloadUrl);
  });

  it("e-mail já cadastrado: reenvia o PDF mas NÃO gera eventId (não infla o Lead)", async () => {
    cenario(
      { email: "ana@exemplo.com" },
      { data: { download_token: DOWNLOAD, descadastro_token: DESCADASTRO }, error: null },
    );
    const r = (await gravar({ data: valido })) as { ok: boolean; eventId?: string };
    expect(r.ok).toBe(true);
    expect(r.eventId).toBeUndefined();
    expect(enviarEmailResend).toHaveBeenCalledTimes(1);
  });

  it("telefone inválido fica fora do payload em vez de apagar o anterior", async () => {
    const up = cenario(null, {
      data: { download_token: DOWNLOAD, descadastro_token: DESCADASTRO },
      error: null,
    });
    await gravar({ data: { ...valido, telefone: "12" } });
    expect(up.upsert.mock.calls[0][0]).not.toHaveProperty("telefone");
  });

  it("falha no upsert devolve motivo erro e não manda e-mail", async () => {
    cenario(null, { data: null, error: { code: "42P01" } });
    expect(await gravar({ data: valido })).toEqual({ ok: false, motivo: "erro" });
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("falha do Resend não derruba: a tela baixa o PDF direto", async () => {
    cenario(null, {
      data: { download_token: DOWNLOAD, descadastro_token: DESCADASTRO },
      error: null,
    });
    enviarEmailResend.mockResolvedValue(false);
    const r = (await gravar({ data: valido })) as { ok: boolean };
    expect(r.ok).toBe(true);
  });
});
