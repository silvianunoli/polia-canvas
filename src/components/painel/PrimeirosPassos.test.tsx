import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";

// O Link do router precisa de contexto de rota; aqui basta o <a> com o href.
vi.mock("@/components/ui/LinkInterno", () => ({
  LinkInterno: ({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest} />
  ),
}));

const { PrimeirosPassos } = await import("./PrimeirosPassos");
const { progressoPrimeirosPassos } = await import("@/lib/primeirosPassos");

afterEach(() => cleanup());

const nada = progressoPrimeirosPassos({ temPreco: false, modulo1Fechado: false, temNome: false });

function montar(over: Partial<Parameters<typeof PrimeirosPassos>[0]> = {}) {
  const props = {
    progresso: nada,
    nicho: null,
    escolhaSalva: null,
    onEscolherTipo: vi.fn(async () => true),
    onSalvarNome: vi.fn(async () => true),
    ...over,
  };
  render(<PrimeirosPassos {...props} />);
  return props;
}

describe("PrimeirosPassos", () => {
  it("rótulo, três passos e destaque no primeiro não feito", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Primeiros passos" })).toBeTruthy();
    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(3);
    expect(itens[0].getAttribute("aria-current")).toBe("step");
    expect(itens[1].getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("0 de 3")).toBeTruthy();
  });

  it("com nicho de serviço, sem pergunta: o botão já leva à aba Serviço", () => {
    montar({ nicho: { pessoa: "Trancista", tipo: "servico" } });
    expect(screen.getByText("Calcular o preço da sua hora")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Produto" })).toBeNull();
    const link = screen.getByRole("link", { name: /Quero calcular meu preço/ });
    expect(link.getAttribute("href")).toBe("/calculadora?tipo=servico");
  });

  it("sem nicho, o botão fica travado até escolher; escolher grava e libera", async () => {
    const props = montar();
    const travado = screen.getByRole("button", { name: /Quero calcular meu preço/ });
    expect((travado as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Os dois" }));
    expect(props.onEscolherTipo).toHaveBeenCalledWith("os_dois");
    const link = await screen.findByRole("link", { name: /Quero calcular meu preço/ });
    expect(link.getAttribute("href")).toBe("/calculadora?tipo=produto");
    expect(screen.getByRole("button", { name: "Os dois" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("business_type já salvo vem marcado", () => {
    montar({ escolhaSalva: "servico" });
    expect(screen.getByRole("button", { name: "Serviço" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("link", { name: /Quero calcular meu preço/ }).getAttribute("href"),
    ).toBe("/calculadora?tipo=servico");
  });

  it("gravação do tipo que falha desfaz a escolha", async () => {
    montar({ onEscolherTipo: vi.fn(async () => false) });
    await userEvent.click(screen.getByRole("button", { name: "Produto" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Produto" }).getAttribute("aria-pressed")).toBe(
        "false",
      ),
    );
  });

  it("feito ganha o check e o destaque desce pro próximo", () => {
    montar({
      progresso: progressoPrimeirosPassos({
        temPreco: true,
        modulo1Fechado: false,
        temNome: false,
      }),
    });
    const itens = screen.getAllByRole("listitem");
    expect(itens[0].textContent).toContain("Feito:");
    expect(itens[1].getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("link", { name: /Quero abrir o Módulo 1/ }).getAttribute("href")).toBe(
      "/planejamento/modulo/1",
    );
  });

  it("nome da marca: salva pelo Enter e, se falhar, o texto fica no campo", async () => {
    const onSalvarNome = vi.fn(async () => false);
    montar({
      progresso: progressoPrimeirosPassos({ temPreco: true, modulo1Fechado: true, temNome: false }),
      onSalvarNome,
    });
    const campo = screen.getByLabelText("Nome da marca") as HTMLInputElement;
    expect((screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await userEvent.type(campo, "Ateliê da Ana{Enter}");
    expect(onSalvarNome).toHaveBeenCalledWith("Ateliê da Ana");
    await waitFor(() => expect(campo.readOnly).toBe(false));
    expect(campo.value).toBe("Ateliê da Ana");
  });
});
