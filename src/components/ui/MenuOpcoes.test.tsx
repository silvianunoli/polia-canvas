import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuOpcoes } from "./MenuOpcoes";
import { Modal } from "./Modal";

// 01/11/2026: abrir um Modal pelo item do menu e fechar deixava o body com
// pointer-events:none, e o "···" dos cartões de Produtos sumia até recarregar.
function MenuQueAbreModal() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <MenuOpcoes itens={[{ label: "Editar", onClick: () => setAberto(true) }]} />
      <Modal open={aberto} onOpenChange={setAberto} title="Editar produto">
        <button type="button" onClick={() => setAberto(false)}>
          Pronto
        </button>
      </Modal>
    </>
  );
}

describe("MenuOpcoes abrindo um Modal", () => {
  it("devolve a página clicável depois que o Modal fecha", async () => {
    const user = userEvent.setup();
    render(<MenuQueAbreModal />);
    await user.click(screen.getByRole("button", { name: "Mais opções" }));
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
    await user.click(await screen.findByRole("button", { name: "Pronto" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
    // e o menu abre de novo sem recarregar
    await user.click(screen.getByRole("button", { name: "Mais opções" }));
    expect(await screen.findByRole("menuitem", { name: "Editar" })).toBeTruthy();
  });
});
