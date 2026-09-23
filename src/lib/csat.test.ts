import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { getSessionMock, insertMock, fromMock, flagAtivaMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  insertMock: vi.fn(),
  fromMock: vi.fn(),
  flagAtivaMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: getSessionMock },
    from: fromMock,
  },
}));

vi.mock("@/lib/flags", () => ({ flagAtiva: flagAtivaMock }));

const { podeMostrarCsat, marcarCsatMostrado, csatFlagAtiva, enviarFeedback } =
  await import("./csat");

const DIA_MS = 24 * 60 * 60 * 1000;
const CHAVE_ULTIMO = "polia-csat-ultimo";
const CHAVE_VISTOS = "polia-csat-vistos";

describe("podeMostrarCsat", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("pode mostrar quando nunca perguntou nada", () => {
    expect(podeMostrarCsat("modulo:razao")).toBe(true);
  });

  it("bloqueia contexto que já foi mostrado (cada conquista pergunta uma vez só)", () => {
    localStorage.setItem(CHAVE_VISTOS, JSON.stringify(["modulo:razao"]));
    expect(podeMostrarCsat("modulo:razao")).toBe(false);
    expect(podeMostrarCsat("modulo:quem")).toBe(true);
  });

  // Concluir dois módulos seguidos não pode empilhar dois pop-ups.
  it("bloqueia qualquer contexto dentro do cooldown de 14 dias", () => {
    localStorage.setItem(CHAVE_ULTIMO, String(Date.now() - 13 * DIA_MS));
    expect(podeMostrarCsat("outro")).toBe(false);
  });

  it("libera de novo quando o último prompt tem 14 dias ou mais", () => {
    localStorage.setItem(CHAVE_ULTIMO, String(Date.now() - 14 * DIA_MS));
    expect(podeMostrarCsat("outro")).toBe(true);
  });

  it("trata JSON corrompido na lista de vistos como lista vazia", () => {
    localStorage.setItem(CHAVE_VISTOS, "{nao-e-json");
    expect(podeMostrarCsat("x")).toBe(true);
  });
});

describe("marcarCsatMostrado", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("grava o contexto na lista de vistos e o instante do último prompt", () => {
    marcarCsatMostrado("modulo:razao");
    expect(JSON.parse(localStorage.getItem(CHAVE_VISTOS)!)).toEqual(["modulo:razao"]);
    expect(localStorage.getItem(CHAVE_ULTIMO)).toBe(String(Date.now()));
  });

  it("acumula contextos sem duplicar", () => {
    marcarCsatMostrado("a");
    marcarCsatMostrado("b");
    marcarCsatMostrado("a");
    expect(JSON.parse(localStorage.getItem(CHAVE_VISTOS)!)).toEqual(["a", "b"]);
  });

  it("depois de marcar, podeMostrarCsat bloqueia o mesmo contexto e os outros pelo cooldown", () => {
    marcarCsatMostrado("a");
    expect(podeMostrarCsat("a")).toBe(false);
    expect(podeMostrarCsat("b")).toBe(false);
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
    expect(podeMostrarCsat("b")).toBe(true);
    expect(podeMostrarCsat("a")).toBe(false);
  });

  it("não explode quando o localStorage está indisponível (modo privado)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => marcarCsatMostrado("a")).not.toThrow();
    setItem.mockRestore();
  });
});

describe("csatFlagAtiva", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("consulta a flag csat_modal_ativo com o id da usuária logada e padrão desligado", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    flagAtivaMock.mockResolvedValue(true);
    expect(await csatFlagAtiva()).toBe(true);
    expect(flagAtivaMock).toHaveBeenCalledWith("csat_modal_ativo", "u1", false);
  });

  it("passa null como usuária quando não há sessão", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    flagAtivaMock.mockResolvedValue(false);
    expect(await csatFlagAtiva()).toBe(false);
    expect(flagAtivaMock).toHaveBeenCalledWith("csat_modal_ativo", null, false);
  });

  it("devolve false quando a sessão falha (nunca mostra CSAT por engano)", async () => {
    getSessionMock.mockRejectedValue(new Error("auth"));
    expect(await csatFlagAtiva()).toBe(false);
  });
});

describe("enviarFeedback", () => {
  beforeEach(() => {
    fromMock.mockReturnValue({ insert: insertMock });
    insertMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("insere em feedback_responses com o id da sessão, gatilho, contexto e nota", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    await enviarFeedback("entregavel_concluido", "modulo:razao", 3);
    expect(fromMock).toHaveBeenCalledWith("feedback_responses");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      trigger_type: "entregavel_concluido",
      context_ref: "modulo:razao",
      score: 3,
      comment: null,
    });
  });

  it("não grava nada sem sessão (RLS só permite INSERT em nome próprio)", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    await enviarFeedback("pulso_periodico", "x", 1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("apara espaços do comentário e corta em 1000 caracteres", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    await enviarFeedback("chamado_resolvido", "x", 2, "  " + "a".repeat(1500) + "  ");
    expect(insertMock.mock.calls[0][0].comment).toBe("a".repeat(1000));
  });

  it("comentário só de espaços vira null", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    await enviarFeedback("chamado_resolvido", "x", 2, "   ");
    expect(insertMock.mock.calls[0][0].comment).toBeNull();
  });

  it("engole falha do insert sem lançar (fire-and-forget)", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    insertMock.mockRejectedValue(new Error("rede"));
    await expect(enviarFeedback("pulso_periodico", "x", 1)).resolves.toBeUndefined();
  });
});
