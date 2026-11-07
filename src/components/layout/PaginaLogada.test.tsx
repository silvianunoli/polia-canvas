import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...rest} />
  ),
}));
vi.mock("@/components/tutorial/PlayerTutorial", () => ({
  PlayerTutorial: ({ titulo }: { titulo: string }) => <div>{titulo}</div>,
}));
vi.mock("@/components/dicas/DicaDaTela", () => ({ DicaDaTela: () => null }));

const { PaginaLogada } = await import("./PaginaLogada");
const { tutorialDaRota } = await import("@/lib/tutoriais");

describe("PaginaLogada: Como usar esta tela", () => {
  beforeEach(() => window.history.pushState({}, "", "/financeiro"));
  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", "/");
  });

  it("abre o tutorial num modal por cima da tela e fechar volta pra ela", async () => {
    const t = tutorialDaRota("/financeiro");
    expect(t).toBeTruthy();

    render(
      <PaginaLogada titulo="O dinheiro do mês.">
        <p>conteúdo da tela</p>
      </PaginaLogada>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Como usar esta tela" }));
    const modal = screen.getByRole("dialog");
    expect(modal.textContent).toContain(`Como usar: ${t!.nome}`);
    expect(modal.textContent).toContain("Passo a passo");
    // Nada dentro do modal tira a usuária da tela.
    expect(modal.textContent).not.toContain("Todos os tutoriais");
    expect(screen.queryByRole("navigation", { name: "Outros tutoriais" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("conteúdo da tela")).toBeTruthy();
    expect(window.location.pathname).toBe("/financeiro");
  });
});
