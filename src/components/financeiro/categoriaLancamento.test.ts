import { describe, expect, it } from "vitest";
import { categoriaParaSalvar, clicarCategoria, type SelecaoCategoria } from "./categoriaLancamento";

const vazio: SelecaoCategoria = { categoria: "", novaAberta: false, novaTexto: "" };

describe("clicarCategoria (QA-28: chip com nova categoria aberta)", () => {
  it("chip com a nova categoria aberta: fecha a nova e salva o chip (antes salvava o texto vazio)", () => {
    const aberta: SelecaoCategoria = { categoria: "", novaAberta: true, novaTexto: "" };
    const depois = clicarCategoria(aberta, { tipo: "chip", valor: "Marketing" });
    expect(depois).toEqual({ categoria: "Marketing", novaAberta: false, novaTexto: "" });
    expect(categoriaParaSalvar(depois)).toBe("Marketing");
  });

  it("chip com texto já digitado na nova: o chip vence e o texto é descartado", () => {
    const aberta: SelecaoCategoria = { categoria: "", novaAberta: true, novaTexto: "Frete" };
    const depois = clicarCategoria(aberta, { tipo: "chip", valor: "Marketing" });
    expect(categoriaParaSalvar(depois)).toBe("Marketing");
  });

  it("abrir a nova categoria desmarca o chip (nunca dois marcados)", () => {
    const comChip = { ...vazio, categoria: "Marketing" };
    const depois = clicarCategoria(comChip, { tipo: "nova" });
    expect(depois.categoria).toBe("");
    expect(depois.novaAberta).toBe(true);
  });

  it("clicar de novo em '+ nova categoria' fecha o campo", () => {
    const aberta: SelecaoCategoria = { categoria: "", novaAberta: true, novaTexto: "Frete" };
    expect(clicarCategoria(aberta, { tipo: "nova" })).toEqual(vazio);
  });

  it("clicar no chip já marcado desmarca", () => {
    const comChip = { ...vazio, categoria: "Marketing" };
    expect(clicarCategoria(comChip, { tipo: "chip", valor: "Marketing" }).categoria).toBe("");
  });
});

describe("categoriaParaSalvar", () => {
  it("nova categoria aberta salva o texto sem espaços nas pontas", () => {
    expect(categoriaParaSalvar({ categoria: "", novaAberta: true, novaTexto: "  Frete " })).toBe(
      "Frete",
    );
  });

  it("nada escolhido = null (categoria é opcional)", () => {
    expect(categoriaParaSalvar(vazio)).toBeNull();
    expect(categoriaParaSalvar({ categoria: "", novaAberta: true, novaTexto: "   " })).toBeNull();
  });
});
