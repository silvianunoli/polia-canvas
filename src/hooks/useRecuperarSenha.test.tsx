import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { FormEvent } from "react";

const { resetPasswordForEmailMock, toastErroMock } = vi.hoisted(() => ({
  resetPasswordForEmailMock: vi.fn(),
  toastErroMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { resetPasswordForEmail: resetPasswordForEmailMock } },
}));
vi.mock("@/lib/toast", () => ({ toastErro: toastErroMock }));

const { useRecuperarSenha } = await import("./useRecuperarSenha");

function submit() {
  return { preventDefault: vi.fn() } as unknown as FormEvent;
}

async function enviar(result: { current: ReturnType<typeof useRecuperarSenha> }, email: string) {
  act(() => result.current.setEmail(email));
  await act(async () => {
    await result.current.handleSubmit(submit());
  });
}

// Cada segundo do cooldown reprograma o próximo setTimeout num useEffect, que
// o React só descarrega ao fim do act: avança um tick por act.
async function passarSegundos(n: number) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
  }
}

describe("useRecuperarSenha", () => {
  beforeEach(() => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("começa vazio, sem erro, sem envio e sem cooldown", () => {
    const { result } = renderHook(() => useRecuperarSenha());
    expect(result.current).toMatchObject({
      email: "",
      error: undefined,
      loading: false,
      sent: null,
      cooldown: 0,
    });
  });

  it("bloqueia e-mail inválido com a mensagem da tela, sem chamar o Supabase", async () => {
    const { result } = renderHook(() => useRecuperarSenha());
    await enviar(result, "ana@");
    expect(result.current.error).toBe("E-mail inválido. Confere o @.");
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("envia o link pro e-mail aparado, com redirect pra /auth/redefinir-senha", async () => {
    const { result } = renderHook(() => useRecuperarSenha());
    await enviar(result, "  ana@exemplo.com  ");
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("ana@exemplo.com", {
      redirectTo: `${window.location.origin}/auth/redefinir-senha`,
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.sent).toBe("ana@exemplo.com");
    expect(result.current.loading).toBe(false);
  });

  it("depois de enviar, abre cooldown de 60 s que cai 1 por segundo", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecuperarSenha());
    await enviar(result, "ana@exemplo.com");
    expect(result.current.cooldown).toBe(60);

    await passarSegundos(1);
    expect(result.current.cooldown).toBe(59);

    await passarSegundos(59);
    expect(result.current.cooldown).toBe(0);

    // e não continua caindo pra negativo
    await passarSegundos(1);
    expect(result.current.cooldown).toBe(0);
  });

  it("quando o Supabase falha, avisa por toast e não marca como enviado", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: { message: "rate limit" } });
    const { result } = renderHook(() => useRecuperarSenha());
    await enviar(result, "ana@exemplo.com");
    expect(toastErroMock).toHaveBeenCalledWith(
      "Não conseguimos enviar agora. Tenta de novo em alguns segundos.",
    );
    expect(result.current.sent).toBeNull();
    expect(result.current.cooldown).toBe(0);
  });

  it("limpa um erro anterior quando o e-mail passa a ser válido", async () => {
    const { result } = renderHook(() => useRecuperarSenha());
    await enviar(result, "x");
    expect(result.current.error).toBeDefined();
    await enviar(result, "ana@exemplo.com");
    expect(result.current.error).toBeUndefined();
  });

  describe("handleResend", () => {
    it("não reenvia antes de ter enviado nem durante o cooldown", async () => {
      const { result } = renderHook(() => useRecuperarSenha());
      await act(async () => {
        await result.current.handleResend();
      });
      expect(resetPasswordForEmailMock).not.toHaveBeenCalled();

      await enviar(result, "ana@exemplo.com");
      await act(async () => {
        await result.current.handleResend();
      });
      expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
    });

    it("depois do cooldown, reenvia pro mesmo e-mail e reabre os 60 s", async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useRecuperarSenha());
      await enviar(result, "ana@exemplo.com");
      await passarSegundos(60);
      expect(result.current.cooldown).toBe(0);

      await act(async () => {
        await result.current.handleResend();
      });
      expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(2);
      expect(resetPasswordForEmailMock).toHaveBeenLastCalledWith("ana@exemplo.com", {
        redirectTo: `${window.location.origin}/auth/redefinir-senha`,
      });
      expect(result.current.cooldown).toBe(60);
    });
  });

  it("reset() volta tudo ao estado inicial", async () => {
    const { result } = renderHook(() => useRecuperarSenha());
    await enviar(result, "ana@exemplo.com");
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ email: "", error: undefined, sent: null, cooldown: 0 });
  });
});
