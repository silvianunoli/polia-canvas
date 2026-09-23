import { describe, it, expect } from "vitest";
import { discoveryNegocio } from "./discovery-negocio";

// Os invariantes genéricos (ids únicos, ordem, opções, vocabulário) rodam em
// registro.test.ts pra todas as pesquisas. Aqui fica só o que é regra desta.
describe("discoveryNegocio", () => {
  const porId = Object.fromEntries(discoveryNegocio.perguntas.map((p) => [p.id, p]));

  it("é enxuta: 15 perguntas, pra tráfego frio responder até o fim", () => {
    expect(discoveryNegocio.slug).toBe("discovery-negocio");
    expect(discoveryNegocio.perguntas).toHaveLength(15);
  });

  it("abre pelo estágio, que classifica quem já vende, quem começou e quem planeja", () => {
    const primeira = discoveryNegocio.perguntas[0];
    expect(primeira.id).toBe("estagio");
    expect(primeira.opcoes!.map((o) => o.id)).toEqual(["ja_vendo", "comecei", "planejando"]);
  });

  // Público ampliado: quem ainda não vende precisa de uma saída nas perguntas
  // que pressupõem venda, senão trava no meio e abandona.
  it("perguntas que pressupõem venda têm escape pra quem ainda não vende", () => {
    expect(porId.preco_como.opcoes!.some((o) => o.id === "ainda_nao")).toBe(true);
    expect(porId.compra_pesa.opcoes!.some((o) => o.id === "ainda_nao")).toBe(true);
    expect(porId.faturamento.opcoes!.some((o) => o.id === "ainda_nao")).toBe(true);
  });

  it("faturamento é opcional e tem 'prefiro não dizer' (dado sensível de dinheiro)", () => {
    expect(porId.faturamento.opcional).toBe(true);
    expect(porId.faturamento.opcoes!.some((o) => o.id === "nao_dizer")).toBe(true);
  });

  it("onde_clareza é múltipla com até 2 escolhas e tem a saída 'me sinto no controle'", () => {
    expect(porId.onde_clareza.tipo).toBe("multipla");
    expect(porId.onde_clareza.maxSelecoes).toBe(2);
    expect(porId.onde_clareza.opcoes!.some((o) => o.id === "no_controle")).toBe(true);
  });

  it("as duas abertas (aperto e episódio) são opcionais e têm placeholder", () => {
    for (const id of ["aperto", "episodio"]) {
      expect(porId[id].tipo).toBe("aberta");
      expect(porId[id].opcional).toBe(true);
      expect(porId[id].placeholder).toBeTruthy();
    }
  });

  it("o bloco de marca/valor (compra_pesa, tem_marca, inseguranca) está presente e é obrigatório", () => {
    for (const id of ["compra_pesa", "tem_marca", "inseguranca"]) {
      expect(porId[id]).toBeDefined();
      expect(porId[id].opcional).toBeFalsy();
    }
  });

  it("toda pergunta é da parte 1 (não há bloco de perfil separado nesta pesquisa)", () => {
    for (const p of discoveryNegocio.perguntas) expect(p.parte).toBe(1);
  });
});
