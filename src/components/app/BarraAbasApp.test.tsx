import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";

// O Link do router precisa de contexto de rota; aqui basta o <a> com o destino.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; search?: { rota?: string } }) => (
    <a href={search?.rota ? `${to}?rota=${search.rota}` : to} {...rest} />
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
// Os formulários de verdade leem o banco; aqui só importa qual abre.
vi.mock("@/components/vendas/ModalRegistrarVenda", () => ({
  ModalRegistrarVenda: () => <div>formulário de venda</div>,
}));
vi.mock("@/components/financeiro/ModalLancamento", () => ({
  ModalLancamento: ({
    tipoInicial,
    somenteMesCorrente,
  }: {
    tipoInicial: string;
    somenteMesCorrente: boolean;
  }) => <div>{`formulário de ${tipoInicial}${somenteMesCorrente ? " só do mês" : ""}`}</div>,
}));
vi.mock("@/components/app/ModalNovaTarefaApp", () => ({
  ModalNovaTarefaApp: () => <div>formulário de tarefa</div>,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

const { BarraAbasApp } = await import("./BarraAbasApp");

afterEach(() => cleanup());

describe("BarraAbasApp", () => {
  it("marca a aba da tela aberta, inclusive em subtela", () => {
    render(<BarraAbasApp pathname="/planner/encomendas" userId="u1" plano="controle" />);
    expect(screen.getByRole("link", { name: "Planner" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Hoje" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Hoje" }).getAttribute("href")).toBe("/painel");
  });

  it("o + abre as três opções e cada uma abre o formulário dela", async () => {
    render(<BarraAbasApp pathname="/painel" userId="u1" plano="controle" />);
    await userEvent.click(screen.getByRole("button", { name: /Registrar venda, gasto ou tarefa/ }));
    expect(screen.getByRole("button", { name: /Lançar gasto/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Registrar venda$/ }));
    expect(screen.getByText("formulário de venda")).toBeTruthy();
  });

  it("no Premium o gasto aceita qualquer data", async () => {
    render(<BarraAbasApp pathname="/painel" userId="u1" plano="controle" />);
    await userEvent.click(screen.getByRole("button", { name: /Registrar venda, gasto ou tarefa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Lançar gasto/ }));
    expect(screen.getByText("formulário de saida")).toBeTruthy();
  });

  it("no Grátis a venda leva ao upgrade e o gasto fica preso ao mês", async () => {
    render(<BarraAbasApp pathname="/painel" userId="u1" plano="confere" />);
    await userEvent.click(screen.getByRole("button", { name: /Registrar venda, gasto ou tarefa/ }));
    const venda = screen.getByRole("link", { name: /Registrar venda/ });
    expect(venda.getAttribute("href")).toBe("/upgrade?rota=/vendas");
    await userEvent.click(screen.getByRole("button", { name: /Lançar gasto/ }));
    expect(screen.getByText("formulário de saida só do mês")).toBeTruthy();
  });

  it("nova tarefa abre o formulário curto", async () => {
    render(<BarraAbasApp pathname="/painel" userId="u1" plano="confere" />);
    await userEvent.click(screen.getByRole("button", { name: /Registrar venda, gasto ou tarefa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Nova tarefa/ }));
    expect(screen.getByText("formulário de tarefa")).toBeTruthy();
  });
});
