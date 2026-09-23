import { describe, it, expect } from "vitest";
import { pesquisaPrecificacao } from "./pesquisa-precificacao";
import { discoveryNegocio } from "./discovery-negocio";

// Os invariantes genéricos rodam em registro.test.ts. Aqui: o que é regra
// específica da pesquisa externa de precificação (Van Westendorp).
describe("pesquisaPrecificacao", () => {
  const porId = Object.fromEntries(pesquisaPrecificacao.perguntas.map((p) => [p.id, p]));
  const PRECO_IDS = [
    "preco_comecaria_cara",
    "preco_cara_demais",
    "preco_bom_negocio",
    "preco_barata_demais",
  ];

  it("tem 17 perguntas e slug próprio", () => {
    expect(pesquisaPrecificacao.slug).toBe("pesquisa-precificacao");
    expect(pesquisaPrecificacao.perguntas).toHaveLength(17);
  });

  // Van Westendorp precisa das 4 perguntas de preço, todas abertas (a pessoa
  // escreve o valor) e opcionais, e em sequência pra leitura fazer sentido.
  it("as 4 perguntas de preço (Van Westendorp) são abertas, opcionais e consecutivas", () => {
    for (const id of PRECO_IDS) {
      expect(porId[id], id).toBeDefined();
      expect(porId[id].tipo, id).toBe("aberta");
      expect(porId[id].opcional, id).toBe(true);
    }
    const ordens = PRECO_IDS.map((id) => porId[id].ordem);
    expect(ordens).toEqual([13, 14, 15, 16]);
  });

  it("pergunta de formalização cobre informal, MEI e ME com saída 'não sei dizer'", () => {
    expect(porId.formalizada.opcoes!.map((o) => o.id)).toEqual([
      "informal",
      "mei",
      "me",
      "nao_sei_dizer",
    ]);
  });

  it("sabe_quanto_tira mede a dor central (quanto sobra) em 3 graus", () => {
    expect(porId.sabe_quanto_tira.opcoes!.map((o) => o.id)).toEqual([
      "sei_precisao",
      "sei_mais_ou_menos",
      "nao_faco_ideia",
    ]);
  });

  // As perguntas compartilhadas com a discovery precisam ter as MESMAS opções:
  // é o que permite comparar o perfil das duas amostras no admin.
  it("perguntas em comum com a discovery mantêm os mesmos ids de opção", () => {
    const discoveryPorId = Object.fromEntries(discoveryNegocio.perguntas.map((p) => [p.id, p]));
    for (const id of ["categoria", "quem_toca", "faturamento", "onde_clareza", "separa_dinheiro"]) {
      expect(
        porId[id].opcoes!.map((o) => o.id),
        id,
      ).toEqual(discoveryPorId[id].opcoes!.map((o) => o.id));
    }
  });

  it("toda pergunta é da parte 1", () => {
    for (const p of pesquisaPrecificacao.perguntas) expect(p.parte).toBe(1);
  });
});
