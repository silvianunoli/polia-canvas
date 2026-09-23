import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

const { csatFlagAtivaMock, enviarFeedbackMock, marcarCsatMostradoMock, podeMostrarCsatMock } =
  vi.hoisted(() => ({
    csatFlagAtivaMock: vi.fn(),
    enviarFeedbackMock: vi.fn(),
    marcarCsatMostradoMock: vi.fn(),
    podeMostrarCsatMock: vi.fn(),
  }));

vi.mock("@/lib/csat", () => ({
  csatFlagAtiva: csatFlagAtivaMock,
  enviarFeedback: enviarFeedbackMock,
  marcarCsatMostrado: marcarCsatMostradoMock,
  podeMostrarCsat: podeMostrarCsatMock,
}));

const { useCsatTrigger } = await import("./useCsatTrigger");

// A flag é assíncrona: deixa as microtasks correrem antes de avançar o relógio.
async function drenar() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useCsatTrigger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    podeMostrarCsatMock.mockReturnValue(true);
    csatFlagAtivaMock.mockResolvedValue(true);
    enviarFeedbackMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("começa escondido e só aparece 1,5 s depois da flag confirmar", async () => {
    const { result } = renderHook(() => useCsatTrigger("entregavel_concluido", "modulo:razao"));
    expect(result.current.mostrar).toBe(false);

    await drenar();
    await avancar(1_499);
    expect(result.current.mostrar).toBe(false);

    await avancar(1);
    expect(result.current.mostrar).toBe(true);
  });

  // "Mostrado" só conta quando o card aparece de fato; marcar antes queimaria
  // o contexto se a usuária saísse da tela durante o respiro.
  it("marca o contexto como mostrado só no momento em que o card aparece", async () => {
    renderHook(() => useCsatTrigger("entregavel_concluido", "modulo:razao"));
    await drenar();
    expect(marcarCsatMostradoMock).not.toHaveBeenCalled();
    await avancar(1_500);
    expect(marcarCsatMostradoMock).toHaveBeenCalledWith("modulo:razao");
  });

  it("não consulta a flag quando o dedupe local já bloqueia", async () => {
    podeMostrarCsatMock.mockReturnValue(false);
    const { result } = renderHook(() => useCsatTrigger("pulso_periodico", "x"));
    await drenar();
    await avancar(2_000);
    expect(csatFlagAtivaMock).not.toHaveBeenCalled();
    expect(result.current.mostrar).toBe(false);
  });

  it("não aparece quando a flag remota está desligada", async () => {
    csatFlagAtivaMock.mockResolvedValue(false);
    const { result } = renderHook(() => useCsatTrigger("pulso_periodico", "x"));
    await drenar();
    await avancar(2_000);
    expect(result.current.mostrar).toBe(false);
    expect(marcarCsatMostradoMock).not.toHaveBeenCalled();
  });

  it("não faz nada enquanto condicao é false", async () => {
    renderHook(() => useCsatTrigger("entregavel_concluido", "x", false));
    await drenar();
    await avancar(2_000);
    expect(podeMostrarCsatMock).not.toHaveBeenCalled();
    expect(csatFlagAtivaMock).not.toHaveBeenCalled();
  });

  it("desmontar durante o respiro cancela: não mostra nem marca", async () => {
    const { result, unmount } = renderHook(() => useCsatTrigger("chamado_resolvido", "c1"));
    await drenar();
    unmount();
    await avancar(2_000);
    expect(result.current.mostrar).toBe(false);
    expect(marcarCsatMostradoMock).not.toHaveBeenCalled();
  });

  it("fechar() esconde o card", async () => {
    const { result } = renderHook(() => useCsatTrigger("chamado_resolvido", "c1"));
    await drenar();
    await avancar(1_500);
    expect(result.current.mostrar).toBe(true);
    act(() => result.current.fechar());
    expect(result.current.mostrar).toBe(false);
  });

  it("enviar() esconde o card e manda gatilho, contexto, nota e comentário", async () => {
    const { result } = renderHook(() => useCsatTrigger("chamado_resolvido", "c1"));
    await drenar();
    await avancar(1_500);
    await act(async () => {
      await result.current.enviar(3, "ótimo");
    });
    expect(result.current.mostrar).toBe(false);
    expect(enviarFeedbackMock).toHaveBeenCalledWith("chamado_resolvido", "c1", 3, "ótimo");
  });
});
