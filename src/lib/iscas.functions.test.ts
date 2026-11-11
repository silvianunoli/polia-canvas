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

import { gravarLeadIsca } from "./iscas.functions";
import { ISCAS } from "./iscas/catalogo";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const gravar = gravarLeadIsca as unknown as Chamavel;
type Resultado = { ok: boolean; downloadUrl?: string; eventId?: string; motivo?: string };

const METODOS = ["select", "eq", "upsert", "single"] as const;
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
const valido = {
  slug: "black-friday",
  email: "Ana@Exemplo.com",
  telefone: "(55) 99876-5432",
  consentimento: true,
  turnstileToken: "tok",
};
const linhaOk = {
  data: { download_token: DOWNLOAD, descadastro_token: DESCADASTRO, descadastrado_em: null },
  error: null,
};

// 1ª consulta: linhas desse e-mail em qualquer isca. 2ª: upsert devolvendo tokens.
function cenario(existentes: unknown[], upsertResultado: unknown = linhaOk) {
  const busca = consulta({ data: existentes, error: null });
  from.mockReturnValueOnce(busca);
  const up = consulta(upsertResultado);
  from.mockReturnValueOnce(up);
  return { busca, up };
}

beforeEach(() => {
  from.mockReset();
  verificarTurnstileServer.mockReset();
  enviarEmailResend.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("gravarLeadIsca: gates", () => {
  it("consentimento false ou telefone vazio rejeitam antes de tudo", async () => {
    await expect(gravar({ data: { ...valido, consentimento: false } })).rejects.toThrow();
    await expect(gravar({ data: { ...valido, telefone: "" } })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("slug fora do catálogo devolve erro sem gravar", async () => {
    expect(await gravar({ data: { ...valido, slug: "natal-2099" } })).toEqual({
      ok: false,
      motivo: "erro",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("honeypot recebe link que não abre nada, sem gravar nem eventId", async () => {
    const r = (await gravar({ data: { ...valido, hp: "bot" } })) as Resultado;
    expect(r.ok).toBe(true);
    expect(r.downloadUrl).toMatch(
      /^https:\/\/one\.usepolia\.com\.br\/materiais\/black-friday\/baixar\?t=[0-9a-f-]{36}$/,
    );
    expect(r.eventId).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it("WhatsApp que não fecha devolve motivo telefone, sem Turnstile nem banco", async () => {
    expect(await gravar({ data: { ...valido, telefone: "1234" } })).toEqual({
      ok: false,
      motivo: "telefone",
    });
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("Turnstile reprovado devolve motivo turnstile sem gravar", async () => {
    verificarTurnstileServer.mockResolvedValue(false);
    expect(await gravar({ data: valido })).toEqual({ ok: false, motivo: "turnstile" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("gravarLeadIsca: gravação", () => {
  beforeEach(() => verificarTurnstileServer.mockResolvedValue(true));

  it("lead novo: upsert por email+isca, telefone normalizado (DDD 55), e-mail e eventId", async () => {
    const { busca, up } = cenario([]);
    const r = (await gravar({ data: valido })) as Resultado;

    expect(busca.eq).toHaveBeenCalledWith("email", "ana@exemplo.com");
    const [payload, opcoes] = up.upsert.mock.calls[0];
    expect(opcoes).toEqual({ onConflict: "email,isca_slug" });
    expect(payload).toEqual(
      expect.objectContaining({
        isca_slug: "black-friday",
        email: "ana@exemplo.com",
        telefone: "5555998765432",
        origem: "instagram_direct",
        consentimento: true,
        consent_texto: ISCAS["black-friday"].consentTexto,
      }),
    );
    // Tokens, created_at e descadastrado_em nunca vão no payload de lead limpo.
    expect(payload).not.toHaveProperty("download_token");
    expect(payload).not.toHaveProperty("descadastro_token");
    expect(payload).not.toHaveProperty("created_at");
    expect(payload).not.toHaveProperty("descadastrado_em");

    expect(r.downloadUrl).toBe(
      `https://one.usepolia.com.br/materiais/black-friday/baixar?t=${DOWNLOAD}`,
    );
    expect(r.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(enviarEmailResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["ana@exemplo.com"],
        subject: ISCAS["black-friday"].email.assunto,
        headers: {
          "List-Unsubscribe": `<https://one.usepolia.com.br/descadastrar?t=${DESCADASTRO}>`,
        },
      }),
    );
  });

  it("mesma isca pedida de novo: reenvia o e-mail, sem eventId", async () => {
    cenario([{ isca_slug: "black-friday", descadastrado_em: null }]);
    const r = (await gravar({ data: valido })) as Resultado;
    expect(r.ok).toBe(true);
    expect(r.eventId).toBeUndefined();
    expect(enviarEmailResend).toHaveBeenCalledTimes(1);
  });

  it("outra isca já pedida antes: é lead novo NESTA isca", async () => {
    cenario([{ isca_slug: "natal", descadastrado_em: null }]);
    const r = (await gravar({ data: valido })) as Resultado;
    expect(r.eventId).toBeDefined();
  });

  it("quem saiu por outra isca continua fora: linha nova herda a data e nenhum e-mail sai", async () => {
    const data = "2026-11-01T00:00:00Z";
    const { up } = cenario([{ isca_slug: "natal", descadastrado_em: data }], {
      data: { download_token: DOWNLOAD, descadastro_token: DESCADASTRO, descadastrado_em: data },
      error: null,
    });
    const r = (await gravar({ data: valido })) as Resultado;
    expect(up.upsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ descadastrado_em: data }),
    );
    expect(r.ok).toBe(true);
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("origem informada substitui a padrão", async () => {
    const { up } = cenario([]);
    await gravar({ data: { ...valido, origem: "carrossel-c05" } });
    expect(up.upsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ origem: "carrossel-c05" }),
    );
  });

  it("falha na consulta ou no upsert devolve erro e não manda e-mail", async () => {
    from.mockReturnValueOnce(consulta({ data: null, error: { code: "42P01" } }));
    expect(await gravar({ data: valido })).toEqual({ ok: false, motivo: "erro" });

    cenario([], { data: null, error: { code: "23505" } });
    expect(await gravar({ data: valido })).toEqual({ ok: false, motivo: "erro" });
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("falha do Resend não derruba o resultado: o lead já está gravado", async () => {
    cenario([]);
    enviarEmailResend.mockResolvedValue(false);
    const r = (await gravar({ data: valido })) as Resultado;
    expect(r.ok).toBe(true);
  });
});
