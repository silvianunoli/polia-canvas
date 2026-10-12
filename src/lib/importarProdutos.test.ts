import { describe, expect, it } from "vitest";
import { gerarCsv } from "@/lib/csv";
import {
  detectarColunasProduto,
  EXEMPLO_MODELO,
  lerPlanilhaProdutos,
  lerTipoProduto,
  marcarJaCadastrados,
  produtosDaPlanilha,
  TITULOS_MODELO,
  type ProdutoImportado,
} from "./importarProdutos";

function ler(texto: string) {
  const r = lerPlanilhaProdutos(texto);
  if (r.tipo !== "pronto") throw new Error(r.tipo);
  return produtosDaPlanilha(r.matriz, r.colunas, r.linhaTitulos);
}

describe("importarProdutos (ONE-121)", () => {
  it("o modelo que a Pólia oferece volta inteiro", () => {
    const { produtos, recusadas } = ler(gerarCsv(TITULOS_MODELO, [EXEMPLO_MODELO]));
    expect(recusadas).toEqual([]);
    expect(produtos[0]).toEqual({
      linha: 2,
      nome: "Caneca de cerâmica pintada",
      tipo: "fisico",
      precoVenda: 89.9,
      precoCusto: 32.5,
      canal: "Instagram e feira",
      descricao: "Caneca de 300 ml, pintada à mão",
      observacaoInterna: "Cód. CAN-014 · Ateliê Barro Bom",
    });
  });

  it("custo não é confundido com preço, mesmo vindo antes", () => {
    const c = detectarColunasProduto(["Produto", "Preço de custo", "Preço de venda"]);
    expect(c).toMatchObject({ nome: 0, custo: 1, precoVenda: 2 });
  });

  it("código e fornecedor entram na observação interna", () => {
    const { produtos } = ler("Nome;Valor;SKU;Fornecedor\nVela de soja;45,00;VEL-02;Cera Viva");
    expect(produtos[0].observacaoInterna).toBe("SKU: VEL-02 · Fornecedor: Cera Viva");
    expect(produtos[0].precoCusto).toBeNull();
  });

  it("linha sem nome ou sem preço fica de fora, com o número da linha", () => {
    const { produtos, recusadas } = ler("Nome;Preço\nVela;45\n;30\nSabonete;");
    expect(produtos.map((p) => p.nome)).toEqual(["Vela"]);
    expect(recusadas).toEqual([
      { linha: 3, motivo: "sem nome" },
      { linha: 4, motivo: "Sabonete sem preço de venda" },
    ]);
  });

  it("sem títulos reconhecíveis, pede pra mapear", () => {
    expect(lerPlanilhaProdutos("Vela;45\nSabonete;20").tipo).toBe("mapear");
  });

  it.each([
    ["Físico", "fisico"],
    ["", "fisico"],
    ["Produto digital", "digital"],
    ["Serviço", "servico"],
    ["servico", "servico"],
  ])("tipo %s vira %s", (bruto, esperado) => {
    expect(lerTipoProduto(bruto)).toBe(esperado);
  });

  it("produto que já está no catálogo ou se repete na planilha vem marcado", () => {
    const p = (nome: string) => ({ nome }) as ProdutoImportado;
    expect(
      marcarJaCadastrados(
        [p("Caneca 300 ml"), p("Caneca 500 ml"), p("Vela"), p("vela ")],
        ["CANECA 300ML", "Sabonete"],
      ),
    ).toEqual([true, false, false, true]);
  });
});
