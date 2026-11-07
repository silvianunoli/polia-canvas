import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.hoisted(() => ({
  precisaConvitePush: vi.fn(),
  ativarPush: vi.fn(),
  adiarConvitePush: vi.fn(),
}));
vi.mock("@/lib/push", () => push);
vi.mock("@/lib/toast", () => ({ toastSucesso: vi.fn(), toastErro: vi.fn() }));

const { ConviteAvisosApp } = await import("./ConviteAvisosApp");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConviteAvisosApp (ONE-188)", () => {
  it("sem convite pendente, não desenha nada e não pede permissão", async () => {
    push.precisaConvitePush.mockResolvedValue(false);
    const { container } = render(<ConviteAvisosApp />);
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
    expect(push.ativarPush).not.toHaveBeenCalled();
  });

  it("explica antes e só pede a permissão do Android no toque", async () => {
    push.precisaConvitePush.mockResolvedValue(true);
    push.ativarPush.mockResolvedValue("ativo");
    render(<ConviteAvisosApp />);

    const botao = await screen.findByRole("button", { name: "Quero receber os avisos" });
    expect(screen.getByRole("region", { name: "Avisos no celular" }).textContent).toContain(
      "entregas de amanhã",
    );
    expect(push.ativarPush).not.toHaveBeenCalled();

    await userEvent.click(botao);
    expect(push.ativarPush).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Avisos no celular" })).toBeNull();
  });

  it("'Agora não' adia o convite e some sem pedir permissão", async () => {
    push.precisaConvitePush.mockResolvedValue(true);
    render(<ConviteAvisosApp />);
    await userEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(push.adiarConvitePush).toHaveBeenCalledTimes(1);
    expect(push.ativarPush).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Avisos no celular" })).toBeNull();
  });
});
