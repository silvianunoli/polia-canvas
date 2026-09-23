import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ResumoContadorMes } from "@/lib/resumoContador.functions";

const { docMock, jsPDFMock } = vi.hoisted(() => {
  const docMock = {
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
  };
  // `new jsPDF(...)` exige função construtora: arrow function não serve.
  const jsPDFMock = vi.fn(function () {
    return docMock;
  });
  return { docMock, jsPDFMock };
});

vi.mock("jspdf", () => ({ jsPDF: jsPDFMock }));

const { gerarResumoContadorPdf } = await import("./gerarResumoContadorPdf");

// Intl pt-BR separa "R$" do número com espaço não separável (U+00A0).
function brl(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function textosEscritos(): string[] {
  return docMock.text.mock.calls.map((c) => String(c[0]));
}

function chamadaDeTexto(texto: string) {
  return docMock.text.mock.calls.find((c) => c[0] === texto);
}

function resumoVazio(): ResumoContadorMes {
  return {
    mes: 9,
    ano: 2026,
    receitas: { total: 0, itens: [] },
    despesas: { total: 0, porCategoria: [], itens: [] },
    proLabore: { total: 0, itens: [] },
    resultado: 0,
  };
}

function resumoCheio(): ResumoContadorMes {
  return {
    mes: 9,
    ano: 2026,
    receitas: {
      total: 1234.5,
      itens: [
        { id: "1", data: "2026-09-05", descricao: "Bolo de cenoura", valor: 1000, tipo: "entrada" },
        { id: "2", data: "2026-09-10", descricao: "  ", valor: 234.5, tipo: "entrada" },
      ],
    },
    despesas: {
      total: 500,
      porCategoria: [
        { categoria: "Insumos", total: 300 },
        { categoria: "Embalagem", total: 100 },
      ],
      itens: [],
    },
    proLabore: { total: 100, itens: [] },
    resultado: 734.5,
  } as unknown as ResumoContadorMes;
}

describe("gerarResumoContadorPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cria um A4 em milímetros e salva com mês zero-padded no nome", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 3,
      ano: 2026,
      resumo: resumoVazio(),
    });
    expect(jsPDFMock).toHaveBeenCalledWith({ unit: "mm", format: "a4" });
    expect(docMock.save).toHaveBeenCalledWith("resumo-contador-polia-03-2026.pdf");
  });

  it("escreve o título e o mês de referência por extenso em pt-BR", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoVazio(),
    });
    expect(textosEscritos()).toContain("Resumo do mês pro contador");
    expect(textosEscritos()).toContain("Pólia · setembro de 2026");
  });

  it("mostra razão social e CNPJ quando existem", () => {
    gerarResumoContadorPdf({
      razaoSocial: "Doces da Ana ME",
      cnpj: "12.345.678/0001-90",
      mes: 9,
      ano: 2026,
      resumo: resumoVazio(),
    });
    expect(textosEscritos()).toContain("Doces da Ana ME");
    expect(textosEscritos()).toContain("CNPJ 12.345.678/0001-90");
  });

  it("omite o bloco de empresa quando não tem razão social nem CNPJ", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoVazio(),
    });
    expect(textosEscritos().some((t) => t.startsWith("CNPJ"))).toBe(false);
  });

  it("mês sem lançamento escreve 'Nenhuma receita' e 'Nenhuma despesa' no lugar das linhas", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoVazio(),
    });
    expect(textosEscritos()).toContain("Nenhuma receita no mês");
    expect(textosEscritos()).toContain("Nenhuma despesa no mês");
  });

  it("formata os totais das seções em moeda pt-BR, alinhados à direita", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoCheio(),
    });
    for (const total of [1234.5, 500, 100, 734.5]) {
      const chamada = chamadaDeTexto(brl(total));
      expect(chamada, brl(total)).toBeDefined();
      expect(chamada![3]).toMatchObject({ align: "right" });
    }
    expect(brl(1234.5)).toBe("R$" + String.fromCharCode(0xa0) + "1.234,50");
  });

  it("cada receita vira 'dd/mm/aaaa · descrição' com o valor em moeda", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoCheio(),
    });
    expect(textosEscritos()).toContain("05/09/2026 · Bolo de cenoura");
    expect(chamadaDeTexto(brl(1000))).toBeDefined();
  });

  it("descrição vazia ou só espaços vira 'sem descrição'", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoCheio(),
    });
    expect(textosEscritos()).toContain("10/09/2026 · sem descrição");
  });

  it("lista despesas por categoria com o total de cada uma", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoCheio(),
    });
    expect(textosEscritos()).toContain("Insumos");
    expect(textosEscritos()).toContain("Embalagem");
    expect(chamadaDeTexto(brl(300))).toBeDefined();
  });

  it("escreve o resultado do mês e o aviso de que não substitui nota fiscal", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoCheio(),
    });
    expect(textosEscritos()).toContain("Resultado do mês");
    expect(textosEscritos().some((t) => t.includes("Não substitui as notas fiscais"))).toBe(true);
  });

  it("não abre página nova num mês curto", () => {
    gerarResumoContadorPdf({
      razaoSocial: null,
      cnpj: null,
      mes: 9,
      ano: 2026,
      resumo: resumoCheio(),
    });
    expect(docMock.addPage).not.toHaveBeenCalled();
  });

  // Uma linha por lançamento: mês movimentado passa do limite de 275 mm.
  it("abre página nova quando as linhas passam do fim da folha", () => {
    const resumo = resumoCheio();
    resumo.receitas.itens = Array.from({ length: 60 }, (_, i) => ({
      id: String(i),
      data: "2026-09-01",
      descricao: `Venda ${i}`,
      valor: 10,
      tipo: "entrada" as const,
    })) as ResumoContadorMes["receitas"]["itens"];
    gerarResumoContadorPdf({ razaoSocial: null, cnpj: null, mes: 9, ano: 2026, resumo });
    expect(docMock.addPage).toHaveBeenCalled();
  });
});
