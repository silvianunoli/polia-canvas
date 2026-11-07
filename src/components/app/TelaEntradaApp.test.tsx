import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";

const { navigateMock, useSupabaseSessionMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  useSupabaseSessionMock: vi.fn(),
}));

// O Link do router precisa de contexto de rota; aqui basta o <a> com o destino.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; search?: { origem?: string } }) => (
    <a href={search?.origem ? `${to}?origem=${search.origem}` : to} {...rest} />
  ),
  useRouter: () => ({ navigate: navigateMock }),
}));
vi.mock("@/hooks/useSupabaseSession", () => ({ useSupabaseSession: useSupabaseSessionMock }));

const { TelaEntradaApp } = await import("./TelaEntradaApp");
const { COOKIE_CONSENT_KEY } = await import("@/lib/cookieConsent");

function sessao({ user = null as { id: string } | null, loading = false } = {}) {
  useSupabaseSessionMock.mockReturnValue({ user, loading, session: user ? { user } : null });
}

describe("TelaEntradaApp", () => {
  beforeEach(() => {
    localStorage.clear();
    sessao();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("sem sessão, mostra Entrar como ação principal e Criar conta grátis com origem app", () => {
    render(<TelaEntradaApp />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Cada encomenda num lugar só.",
    );
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe("/auth/login");
    expect(screen.getByRole("link", { name: "Criar conta grátis" }).getAttribute("href")).toBe(
      "/auth/cadastro?origem=app",
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("com sessão, vai direto pra aba Hoje (replace) sem mostrar os botões", () => {
    sessao({ user: { id: "u1" } });
    render(<TelaEntradaApp />);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/hoje", replace: true });
    expect(screen.queryByRole("link", { name: "Entrar" })).toBeNull();
  });

  it("enquanto a sessão carrega, mostra só a marca, sem botões nem redirect", () => {
    sessao({ loading: true });
    render(<TelaEntradaApp />);
    expect(screen.getByRole("status").textContent).toContain("Abrindo a Pólia One");
    expect(screen.queryByRole("link", { name: "Entrar" })).toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("sem escolha de cookies, pede na linha do rodapé e grava Aceitar", async () => {
    render(<TelaEntradaApp />);
    await userEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe("accepted");
    expect(screen.queryByRole("group", { name: "Cookies de análise" })).toBeNull();
  });

  it("Só essenciais grava essential", async () => {
    render(<TelaEntradaApp />);
    await userEvent.click(screen.getByRole("button", { name: "Só essenciais" }));
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe("essential");
  });

  it("com escolha já feita, a linha de cookies não aparece", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "essential");
    render(<TelaEntradaApp />);
    expect(screen.queryByRole("group", { name: "Cookies de análise" })).toBeNull();
  });
});
