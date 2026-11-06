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

const nada = progressoPrimeirosPassos({ temPreco: false, temPedido: false, temEntregue: false });
// Encomenda lançada e entregue: o destaque chega no passo do preço.
const noPreco = progressoPrimeirosPassos({ temPreco: false, temPedido: true, temEntregue: true });

function montar(over: Partial<Parameters<typeof PrimeirosPassos>[0]> = {}) {
  const props = {
    progresso: nada,
    nicho: null,
    escolhaSalva: null,
    onEscolherTipo: vi.fn(async () => true),
    estagioSalvo: null,
    onEscolherEstagio: vi.fn(async () => true),
    // Respondido por padrão: os testes dos passos não dependem da pergunta.
    nichoSalvo: "comida" as const,
    onEscolherNicho: vi.fn(async () => true),
    ...over,
  };
  render(<PrimeirosPassos {...props} />);
  return props;
}

describe("PrimeirosPassos", () => {
  it("sem nicho, a pergunta vem antes e os passos ficam sem ação até responder", async () => {
    const props = montar({ nichoSalvo: null });
    expect(screen.getByText("Antes dos passos: qual é o nicho da marca?")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Quero lançar a encomenda/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Comida e doces/ }));
    expect(props.onEscolherNicho).toHaveBeenCalledWith("comida");
  });

  it("fala do bônus de 7 dias só quando o teste do Pro está aberto (ONE-136)", () => {
    montar({ bonusDias: 7 });
    expect(
      screen.getByText("Encomenda lançada e entregue, o teste do Pro ganha mais 7 dias."),
    ).toBeTruthy();
    cleanup();
    montar({ bonusDias: 7, escolhaSalva: "servico" });
    expect(
      screen.getByText("Pedido lançado e entregue, o teste do Pro ganha mais 7 dias."),
    ).toBeTruthy();
    cleanup();
    montar();
    expect(screen.queryByText(/o teste do Pro ganha mais/)).toBeNull();
  });

  it("abre na encomenda: o primeiro passo é lançar, e o preço vem por último (ONE-175)", () => {
    montar();
    const itens = screen.getAllByRole("listitem");
    expect(itens[0].textContent).toContain("Lançar a próxima encomenda");
    expect(itens[0].getAttribute("aria-current")).toBe("step");
    expect(itens[1].textContent).toContain("Marcar como entregue e ver o lucro");
    expect(itens[2].textContent).toContain("Calcular o preço de um produto");
    expect(
      screen.getByRole("link", { name: /Quero lançar a encomenda/ }).getAttribute("href"),
    ).toBe("/pedidos");
    expect(screen.queryByRole("link", { name: /Quero calcular meu preço/ })).toBeNull();
  });

  it("passo do preço feito mostra o número dela e leva pra Calculadora (GRW-90)", () => {
    const comPreco = progressoPrimeirosPassos({
      temPreco: true,
      temPedido: false,
      temEntregue: false,
    });
    montar({
      progresso: comPreco,
      primeiroPreco: { id: "p1", nome: "Bolo de pote", preco: 18, lucro: 7 },
    });
    const linha = screen.getByText(/Bolo de pote:/);
    // formatarReais tira os centavos de valor redondo (padrão do Painel).
    expect(linha.textContent).toMatch(/R\$\s?18 ·/);
    expect(linha.textContent).toMatch(/lucra R\$\s?7 por venda/);
    expect(screen.getByRole("link", { name: "Ver na Calculadora" }).getAttribute("href")).toBe(
      "/calculadora?produto=p1",
    );
  });

  it("com nicho salvo, a pergunta não aparece", () => {
    montar();
    expect(screen.queryByText("Antes dos passos: qual é o nicho da marca?")).toBeNull();
  });

  it("pergunta do estágio só depois do primeiro pedido, e some com resposta salva", async () => {
    montar();
    expect(screen.queryByText("E a marca, já vende?")).toBeNull();
    cleanup();
    const comPedido = progressoPrimeirosPassos({
      temPreco: false,
      temPedido: true,
      temEntregue: false,
    });
    const props = montar({ progresso: comPedido });
    await userEvent.click(screen.getByRole("button", { name: "Já vende" }));
    expect(props.onEscolherEstagio).toHaveBeenCalledWith("ja_vendo");
    cleanup();
    montar({ progresso: comPedido, estagioSalvo: "ideia" });
    expect(screen.queryByText("E a marca, já vende?")).toBeNull();
  });

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
    montar({ progresso: noPreco, nicho: { pessoa: "Trancista", tipo: "servico", negocio: null } });
    expect(screen.getByText("Calcular o preço da sua hora")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Produto" })).toBeNull();
    const link = screen.getByRole("link", { name: /Quero calcular meu preço/ });
    expect(link.getAttribute("href")).toBe("/calculadora?tipo=servico");
  });

  it("sem nicho, o botão fica travado até escolher; escolher grava e libera", async () => {
    const props = montar({ progresso: noPreco });
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
    montar({ progresso: noPreco, escolhaSalva: "servico" });
    expect(screen.getByRole("button", { name: "Serviço" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      screen.getByRole("link", { name: /Quero calcular meu preço/ }).getAttribute("href"),
    ).toBe("/calculadora?tipo=servico");
  });

  it("gravação do tipo que falha desfaz a escolha", async () => {
    montar({ progresso: noPreco, onEscolherTipo: vi.fn(async () => false) });
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
        temPreco: false,
        temPedido: true,
        temEntregue: false,
      }),
    });
    const itens = screen.getAllByRole("listitem");
    expect(itens[0].textContent).toContain("Feito:");
    expect(itens[1].getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("Marcar como entregue e ver o lucro")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Quero abrir o quadro de Pedidos/ }).getAttribute("href"),
    ).toBe("/pedidos");
    expect(screen.queryByText(/Módulo 1|Planejamento|Dar nome à marca/)).toBeNull();
  });

  it("com a entrega feita, o destaque chega no preço, o último", () => {
    montar({ progresso: noPreco });
    const itens = screen.getAllByRole("listitem");
    expect(itens[2].getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: /Quero calcular meu preço/ })).toBeTruthy();
  });
});
