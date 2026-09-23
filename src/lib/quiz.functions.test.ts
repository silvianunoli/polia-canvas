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

import { gravarLeadQuiz, descadastrarLeadQuiz, reinscreverLeadQuiz } from "./quiz.functions";
import { calcularResultado, type RespostasQuiz } from "./quiz/pontuacao";
import { CONSENT_TEXTO } from "./quiz/perguntas";

type Chamavel = (opts?: { data?: unknown }) => Promise<unknown>;
const gravar = gravarLeadQuiz as unknown as Chamavel;
const descadastrar = descadastrarLeadQuiz as unknown as Chamavel;
const reinscrever = reinscreverLeadQuiz as unknown as Chamavel;

const METODOS = ["upsert", "select", "single", "update", "eq"] as const;
type Consulta = {
  [K in (typeof METODOS)[number]]: Mock<(...args: unknown[]) => Consulta>;
} & PromiseLike<unknown>;
function consulta(resultado: unknown): Consulta {
  const q = {} as Consulta;
  for (const m of METODOS) q[m] = vi.fn((..._args: unknown[]) => q);
  q.then = (res, rej) => Promise.resolve(resultado).then(res, rej);
  return q;
}

const respostasCompletas: RespostasQuiz = {
  q1: "a",
  q2: "b",
  q3: "c",
  q4: "a",
  q5: "b",
  q6: "c",
  q7: "a",
  q8: "b",
};

const valido = {
  email: "Ana@Exemplo.com",
  consentimento: true,
  respostas: respostasCompletas,
  turnstileToken: "tok",
};

const TOKEN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

beforeEach(() => {
  from.mockReset();
  verificarTurnstileServer.mockReset();
  enviarEmailResend.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("gravarLeadQuiz: validação", () => {
  it("consentimento tem que ser literalmente true (LGPD: sem opt-in implícito)", async () => {
    await expect(gravar({ data: { ...valido, consentimento: false } })).rejects.toThrow();
    await expect(gravar({ data: { ...valido, consentimento: "sim" } })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("origem só aceita slug simples (nada de URL ou espaço)", async () => {
    await expect(gravar({ data: { ...valido, origem: "http://x" } })).rejects.toThrow();
    await expect(gravar({ data: { ...valido, origem: "tem espaco" } })).rejects.toThrow();
  });
});

describe("gravarLeadQuiz: gates", () => {
  it("honeypot finge sucesso sem gravar", async () => {
    expect(await gravar({ data: { ...valido, hp: "bot" } })).toEqual({ ok: true });
    expect(verificarTurnstileServer).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("Turnstile reprovado devolve motivo turnstile sem gravar", async () => {
    verificarTurnstileServer.mockResolvedValue(false);
    expect(await gravar({ data: valido })).toEqual({ ok: false, motivo: "turnstile" });
    expect(from).not.toHaveBeenCalled();
  });

  it("respostas incompletas ou com id forjado devolvem motivo incompleto", async () => {
    verificarTurnstileServer.mockResolvedValue(true);
    const { q8: _q8, ...semUma } = respostasCompletas;
    expect(await gravar({ data: { ...valido, respostas: semUma } })).toEqual({
      ok: false,
      motivo: "incompleto",
    });
    expect(
      await gravar({ data: { ...valido, respostas: { ...respostasCompletas, q1: "z" } } }),
    ).toEqual({ ok: false, motivo: "incompleto" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("gravarLeadQuiz: gravação e diagnóstico", () => {
  beforeEach(() => verificarTurnstileServer.mockResolvedValue(true));

  it("recalcula faixa/pontos no servidor, faz upsert por e-mail e manda o diagnóstico", async () => {
    const q = consulta({ data: { descadastro_token: TOKEN }, error: null });
    from.mockReturnValueOnce(q);
    const esperado = calcularResultado(respostasCompletas);

    expect(await gravar({ data: { ...valido, telefone: "11987654321" } })).toEqual({ ok: true });

    expect(from).toHaveBeenCalledWith("quiz_leads");
    const [payload, opcoes] = q.upsert.mock.calls[0];
    expect(opcoes).toEqual({ onConflict: "email" });
    expect(payload).toEqual(
      expect.objectContaining({
        email: "ana@exemplo.com",
        faixa: esperado.faixa.nome,
        territorio_fraco: esperado.territorioFraco.nome,
        pontos: esperado.pontos,
        respostas: respostasCompletas,
        origem: "instagram_bio",
        consentimento: true,
        consent_texto: CONSENT_TEXTO,
        descadastrado_em: null,
        telefone: "5511987654321",
      }),
    );
    // created_at e descadastro_token nunca vão no payload: em conflito
    // sobrescreveriam a primeira captura e o link já enviado.
    expect(payload).not.toHaveProperty("created_at");
    expect(payload).not.toHaveProperty("descadastro_token");

    expect(enviarEmailResend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["ana@exemplo.com"],
        replyTo: "oi@usepolia.com.br",
        headers: {
          "List-Unsubscribe": `<https://one.usepolia.com.br/descadastrar?t=${TOKEN}>`,
        },
        contexto: "[Quiz]",
      }),
    );
  });

  it("sem telefone o campo fica fora do payload (não apaga o que já existia)", async () => {
    const q = consulta({ data: { descadastro_token: TOKEN }, error: null });
    from.mockReturnValueOnce(q);
    await gravar({ data: { ...valido, telefone: "123" } });
    expect(q.upsert.mock.calls[0][0]).not.toHaveProperty("telefone");
  });

  it("origem informada substitui o padrão instagram_bio", async () => {
    const q = consulta({ data: { descadastro_token: TOKEN }, error: null });
    from.mockReturnValueOnce(q);
    await gravar({ data: { ...valido, origem: "anuncio-meta" } });
    expect(q.upsert.mock.calls[0][0]).toEqual(expect.objectContaining({ origem: "anuncio-meta" }));
  });

  it("falha no upsert devolve motivo erro e não manda e-mail", async () => {
    from.mockReturnValueOnce(consulta({ data: null, error: { code: "42P01" } }));
    expect(await gravar({ data: valido })).toEqual({ ok: false, motivo: "erro" });
    expect(enviarEmailResend).not.toHaveBeenCalled();
  });

  it("falha do Resend não derruba o resultado: o lead já está gravado", async () => {
    from.mockReturnValueOnce(consulta({ data: { descadastro_token: TOKEN }, error: null }));
    enviarEmailResend.mockResolvedValue(false);
    expect(await gravar({ data: valido })).toEqual({ ok: true });
  });
});

describe("descadastro (quiz_leads e manual_leads pelo mesmo link)", () => {
  it("token que não é uuid rejeita antes de encostar no banco", async () => {
    await expect(descadastrar({ data: { token: "abc" } })).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it("acha na quiz_leads: marca descadastrado_em e nem olha manual_leads", async () => {
    const quiz = consulta({ data: [{ id: 1 }], error: null });
    from.mockReturnValueOnce(quiz);
    expect(await descadastrar({ data: { token: TOKEN } })).toEqual({ ok: true });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("quiz_leads");
    expect(quiz.update).toHaveBeenCalledWith({ descadastrado_em: expect.any(String) });
    expect(quiz.eq).toHaveBeenCalledWith("descadastro_token", TOKEN);
  });

  it("não acha na quiz_leads: tenta manual_leads", async () => {
    from.mockReturnValueOnce(consulta({ data: [], error: null }));
    const manual = consulta({ data: [{ id: 9 }], error: null });
    from.mockReturnValueOnce(manual);
    expect(await descadastrar({ data: { token: TOKEN } })).toEqual({ ok: true });
    expect(from).toHaveBeenLastCalledWith("manual_leads");
  });

  it("token de lista nenhuma devolve ok false, igual a erro (não confirma o que é)", async () => {
    from.mockReturnValueOnce(consulta({ data: [], error: null }));
    from.mockReturnValueOnce(consulta({ data: [], error: null }));
    expect(await descadastrar({ data: { token: TOKEN } })).toEqual({ ok: false });
  });

  it("erro do banco em qualquer tabela devolve ok false", async () => {
    from.mockReturnValueOnce(consulta({ data: null, error: { message: "x" } }));
    expect(await descadastrar({ data: { token: TOKEN } })).toEqual({ ok: false });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("reinscrever zera descadastrado_em", async () => {
    const quiz = consulta({ data: [{ id: 1 }], error: null });
    from.mockReturnValueOnce(quiz);
    expect(await reinscrever({ data: { token: TOKEN } })).toEqual({ ok: true });
    expect(quiz.update).toHaveBeenCalledWith({ descadastrado_em: null });
  });
});
