import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmarAcao } from "./ConfirmarAcao";

afterEach(() => cleanup());

function botaoConfirmar(nome: RegExp) {
  return screen.getByRole("button", { name: nome });
}

describe("ConfirmarAcao", () => {
  it("ação síncrona: dispara uma vez e fecha (comportamento antigo)", () => {
    const onConfirmar = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmarAcao
        open
        onOpenChange={onOpenChange}
        titulo="Arquivar?"
        textoConfirmar="Arquivar"
        onConfirmar={onConfirmar}
      />,
    );
    fireEvent.click(botaoConfirmar(/Arquivar/));
    fireEvent.click(botaoConfirmar(/Arquivar/));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ação assíncrona: fica aberto com 'Excluindo…', trava o segundo clique e não fecha sozinho", async () => {
    let terminar!: () => void;
    const onConfirmar = vi.fn(
      () =>
        new Promise<void>((r) => {
          terminar = r;
        }),
    );
    const onOpenChange = vi.fn();
    render(
      <ConfirmarAcao
        open
        onOpenChange={onOpenChange}
        titulo="Excluir?"
        textoConfirmar="Excluir"
        textoCarregando="Excluindo…"
        onConfirmar={onConfirmar}
      />,
    );
    fireEvent.click(botaoConfirmar(/Excluir/));
    // Segundo clique no mesmo botão, já com o texto de carregando.
    fireEvent.click(botaoConfirmar(/Exclu/));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Excluindo…")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await act(async () => {
      terminar();
    });
    // Quem fecha no sucesso é o chamador; se falhou, dá pra tentar de novo.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText("Excluir")).toBeTruthy();
    fireEvent.click(botaoConfirmar(/Excluir/));
    expect(onConfirmar).toHaveBeenCalledTimes(2);
  });
});
