import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CHAVE_CONSULTORIA_FECHADA,
  CartaoConsultoria,
  ESPERA_CONSULTORIA_MS,
  LINK_WHATSAPP_CONSULTORIA,
  consultoriaVisivel,
} from "./CartaoConsultoria";

beforeEach(() => localStorage.clear());
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

  it("o X esconde o cartão e guarda quando foi fechado", async () => {
    render(<CartaoConsultoria />);
    await userEvent.click(screen.getByRole("button", { name: /Fechar a Consultoria/ }));

    expect(screen.queryByRole("region", { name: /nas suas costas/ })).toBeNull();
    expect(Number(localStorage.getItem(CHAVE_CONSULTORIA_FECHADA))).toBeGreaterThan(0);
  });

  it("fechado há menos de 24 horas, não aparece", () => {
    localStorage.setItem(CHAVE_CONSULTORIA_FECHADA, String(Date.now() - 60_000));
    render(<CartaoConsultoria />);
    expect(screen.queryByRole("region", { name: /nas suas costas/ })).toBeNull();
  });

  it("fechado há mais de 24 horas, volta", () => {
    localStorage.setItem(
      CHAVE_CONSULTORIA_FECHADA,
      String(Date.now() - ESPERA_CONSULTORIA_MS - 1000),
    );
    render(<CartaoConsultoria />);
    expect(screen.getByRole("region", { name: /nas suas costas/ })).toBeTruthy();
  });
});

describe("consultoriaVisivel", () => {
  const agora = 1_800_000_000_000;

  it("nunca fechado ou valor estragado mostra", () => {
    expect(consultoriaVisivel(null, agora)).toBe(true);
    expect(consultoriaVisivel("abc", agora)).toBe(true);
  });

  it("esconde até completar 24 horas e mostra a partir daí", () => {
    expect(consultoriaVisivel(String(agora - ESPERA_CONSULTORIA_MS + 1), agora)).toBe(false);
    expect(consultoriaVisivel(String(agora - ESPERA_CONSULTORIA_MS), agora)).toBe(true);
  });
});
