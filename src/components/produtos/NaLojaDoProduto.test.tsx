import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "https://foto" } }) }) },
  },
}));

import { NaLojaDoProduto } from "./NaLojaDoProduto";
import type { LojaDoProduto } from "./useLojaDoProduto";

const combinacao = (extra = {}) => ({
  chave: "azul|p",
  nome: "Azul / P",
  opcoes: { Cor: "Azul", Tamanho: "P" },
  preco: "",
  fotoPath: null,
  inicial: "",
  ...extra,
});

const loja = (extra: Partial<LojaDoProduto> = {}) =>
  ({
    temLoja: true,
    carregando: false,
    erroAoCarregar: false,
    categorias: [{ id: "c1", nome: "Bolsas" }],
    saldoPadrao: null,
    controla: false,
    setControla: vi.fn(),
    categoriaId: "",
    setCategoriaId: vi.fn(),
    prazo: "",
    setPrazo: vi.fn(),
    pacote: { pesoKg: "", alturaCm: "", larguraCm: "", comprimentoCm: "" },
    mudarPacote: vi.fn(),
    eixos: [],
    combinacoes: [],
    inicialPadrao: "",
    setInicialPadrao: vi.fn(),
    mudarEixos: vi.fn(),
    novaOpcao: vi.fn(),
    mudarCombinacao: vi.fn(),
    subirFoto: vi.fn(),
    criarCategoria: vi.fn(),
    saemComEstoque: [],
    problemaPara: vi.fn(),
    salvar: vi.fn(),
    ...extra,
  }) as unknown as LojaDoProduto;

describe("NaLojaDoProduto", () => {
  it("sob encomenda mostra o prazo e nenhuma quantidade", () => {
    render(<NaLojaDoProduto loja={loja({ combinacoes: [combinacao()] })} ehKit={false} />);
    expect(screen.getByLabelText(/Prazo de produção/)).toBeTruthy();
    expect(screen.queryByLabelText("Quantidade agora")).toBeNull();
    expect(screen.getByText("Azul / P")).toBeTruthy();
  });

  it("com estoque, combinação nova pede quantidade e a salva mostra o saldo", () => {
    render(
      <NaLojaDoProduto
        loja={loja({
          controla: true,
          combinacoes: [
            combinacao(),
            combinacao({ chave: "azul|g", nome: "Azul / G", id: "x", saldo: 4 }),
          ],
        })}
        ehKit={false}
      />,
    );
    expect(screen.getAllByLabelText("Quantidade agora")).toHaveLength(1);
    expect(screen.getByText("4 no estoque")).toBeTruthy();
    expect(screen.queryByLabelText(/Prazo de produção/)).toBeNull();
  });

  it("produto sem opções com estoque pede a quantidade uma vez", () => {
    render(<NaLojaDoProduto loja={loja({ controla: true })} ehKit={false} />);
    expect(screen.getAllByLabelText("Quantidade agora")).toHaveLength(1);
  });

  it("trocar para estoque chama a mudança", () => {
    const l = loja();
    render(<NaLojaDoProduto loja={l} ehKit={false} />);
    fireEvent.click(screen.getByLabelText("Tenho em estoque"));
    expect(l.setControla).toHaveBeenCalledWith(true);
  });

  it("kit só mostra categoria e prazo", () => {
    render(<NaLojaDoProduto loja={loja()} ehKit />);
    expect(screen.queryByText("Opções do produto")).toBeNull();
    expect(screen.queryByLabelText("Sob encomenda")).toBeNull();
    expect(screen.getByLabelText(/Prazo de produção/)).toBeTruthy();
  });

  it("avisa quando uma combinação com estoque vai sair", () => {
    render(<NaLojaDoProduto loja={loja({ saemComEstoque: ["Azul / P"] })} ehKit={false} />);
    expect(screen.getByRole("alert").textContent).toContain("Azul / P");
  });

  it("mostra carregando e erro sem os campos", () => {
    const { rerender } = render(
      <NaLojaDoProduto loja={loja({ carregando: true })} ehKit={false} />,
    );
    expect(screen.getByText(/Carregando/)).toBeTruthy();
    rerender(<NaLojaDoProduto loja={loja({ erroAoCarregar: true })} ehKit={false} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByLabelText("Categoria")).toBeNull();
  });
});
