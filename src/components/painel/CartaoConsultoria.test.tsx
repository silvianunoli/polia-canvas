import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CartaoConsultoria, LINK_WHATSAPP_CONSULTORIA } from "./CartaoConsultoria";

afterEach(() => cleanup());

describe("CartaoConsultoria", () => {
  it("o botão abre o WhatsApp da Consultoria em outra aba, com a mensagem pronta", () => {
    render(<CartaoConsultoria />);
    const botao = screen.getByRole("link", { name: /Quero a Consultoria/ });

    expect(botao.getAttribute("href")).toBe(LINK_WHATSAPP_CONSULTORIA);
    expect(LINK_WHATSAPP_CONSULTORIA.startsWith("https://wa.me/5511996963296?text=")).toBe(true);
    expect(decodeURIComponent(LINK_WHATSAPP_CONSULTORIA.split("text=")[1])).toContain(
      "Painel da Pólia One",
    );
    expect(botao.getAttribute("target")).toBe("_blank");
    expect(botao.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("tem título próprio pra leitor de tela achar o bloco", () => {
    render(<CartaoConsultoria />);
    expect(screen.getByRole("region", { name: /nas suas costas/ })).toBeTruthy();
  });
});
