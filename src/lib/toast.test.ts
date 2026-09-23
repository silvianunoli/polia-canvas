import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { toastMock } = vi.hoisted(() => {
  const toastMock = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toastMock };
});

vi.mock("sonner", () => ({ toast: toastMock }));

const { toastSucesso, toastInfo, toastErro } = await import("./toast");

describe("toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("toastSucesso some em 4 s e repassa a ação", () => {
    const action = { label: "Desfazer", onClick: vi.fn() };
    toastSucesso("Salvo", { action });
    expect(toastMock.success).toHaveBeenCalledWith("Salvo", { duration: 4000, action });
  });

  it("toastInfo usa o toast neutro, também por 4 s", () => {
    toastInfo("Copiado");
    expect(toastMock).toHaveBeenCalledWith("Copiado", { duration: 4000, action: undefined });
  });

  it("toastErro fica 6 s (erro não pode sumir antes de ser lido)", () => {
    toastErro("Não conseguimos salvar");
    expect(toastMock.error).toHaveBeenCalledWith("Não conseguimos salvar", {
      duration: 6000,
      action: undefined,
    });
  });

  // O sonner só tem uma região aria-live="polite"; erro precisa de assertive.
  it("toastErro anuncia a mensagem numa região aria-live=assertive só pra leitor de tela", () => {
    toastErro("Deu erro");
    const region = document.getElementById("toast-assertive-live");
    expect(region).not.toBeNull();
    expect(region!.getAttribute("role")).toBe("alert");
    expect(region!.getAttribute("aria-live")).toBe("assertive");
    expect(region!.classList.contains("sr-only")).toBe(true);

    // limpa primeiro e escreve 30 ms depois, pra o leitor de tela perceber a mudança
    expect(region!.textContent).toBe("");
    vi.advanceTimersByTime(30);
    expect(region!.textContent).toBe("Deu erro");
  });

  it("reaproveita a mesma região em erros seguidos, sem duplicar no DOM", () => {
    toastErro("um");
    toastErro("dois");
    expect(document.querySelectorAll("#toast-assertive-live")).toHaveLength(1);
    vi.advanceTimersByTime(30);
    expect(document.getElementById("toast-assertive-live")!.textContent).toBe("dois");
  });
});
