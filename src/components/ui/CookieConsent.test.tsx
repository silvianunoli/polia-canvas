import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";

const { isNativeAppMock } = vi.hoisted(() => ({ isNativeAppMock: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...rest} />
  ),
}));
vi.mock("@/lib/platform", () => ({ isNativeApp: isNativeAppMock }));
// O jsdom não tem matchMedia; aqui só importa se o aviso aparece.
vi.mock("@/hooks/usePrefersReducedMotion", () => ({ usePrefersReducedMotion: () => true }));

const { CookieConsent } = await import("./CookieConsent");

describe("CookieConsent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    isNativeAppMock.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("no site, sem escolha feita, aparece depois de 2 segundos", () => {
    render(<CookieConsent />);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("dialog", { name: "Aviso de cookies" })).toBeTruthy();
  });

  // AND-10: dentro do app a escolha fica na linha da tela /app.
  it("dentro do app Android, não aparece por cima das telas", () => {
    isNativeAppMock.mockReturnValue(true);
    render(<CookieConsent />);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("dialog", { name: "Aviso de cookies" })).toBeNull();
  });
});
