import { describe, it, expect } from "vitest";
import { montarPromptAimer } from "./aimer.functions";
import { montarPromptRaioX } from "./raiox.functions";
import { montarPromptMes } from "./planoConteudo.functions";
import { montarPrompt as montarPromptPlanejamento } from "./planejamentoIa.functions";

// Higiene dos prompts de IA: nenhum prompt ensina o modelo a usar travessão
// (o modelo repete o que vê), e todos carregam a regra explícita de saída.
// A garantia determinística fica no sanitizador (ver gemini.server.test.ts);
// aqui é a primeira camada, o prompt limpo.

const REGRA_SAIDA =
  "Nunca use travessão (—) nem meia-risca (–) na resposta. Use vírgula, dois pontos ou ponto final. Essa regra não tem exceção.";

// A única menção legítima aos caracteres é dentro da própria regra.
function semTravessaoForaDaRegra(texto: string) {
  return !/[—–―‑]/.test(texto.split(REGRA_SAIDA).join(""));
}

const CONTEXTO_MARCA = {
  proposito: "p",
  missao: "m",
  personalidade: "pe",
  tom: "t",
  fraseValor: "f",
  perfilCliente: "pc",
  dores: "d",
  gatilhos: "g",
  posicionamento: "po",
  produtos: "pr",
  transformacao: "tr",
  voz: "v",
  antiExemplos: "a",
  canalPrincipal: "c",
};

describe("prompts de IA sem travessão e com a regra de saída", () => {
  it("Aimer", () => {
    const { systemInstruction, prompt } = montarPromptAimer({
      pergunta: "Qual produto sobra mais?",
      historico: [{ autor: "user", texto: "oi" }],
      contextoProjete: "Entradas do mês: R$ 1.000,00",
    });
    expect(systemInstruction).toContain(REGRA_SAIDA);
    expect(semTravessaoForaDaRegra(systemInstruction + prompt)).toBe(true);
  });

  it("Raio-x do mês", () => {
    const { systemInstruction, prompt } = montarPromptRaioX({
      mes: "2026-08",
      entradas: 1000,
      saidas: 400,
      resultado: 600,
      metaAlvo: 2000,
      metaAtual: 600,
      produtos: [{ nome: "Bolo", sobraPct: 40 }],
      dadoRalo: true,
    });
    expect(systemInstruction).toContain(REGRA_SAIDA);
    expect(semTravessaoForaDaRegra(systemInstruction + prompt)).toBe(true);
  });

  it("Plano de conteúdo", () => {
    const { systemInstruction, prompt } = montarPromptMes({
      mes: 8,
      ano: 2026,
      diasNoMes: 31,
      contexto: CONTEXTO_MARCA,
    });
    expect(systemInstruction).toContain(REGRA_SAIDA);
    expect(semTravessaoForaDaRegra(systemInstruction + prompt)).toBe(true);
  });

  it("Planejamento (rascunho de campo)", () => {
    const { systemInstruction, prompt } = montarPromptPlanejamento("Qual é o propósito?", {
      businessType: "doceria",
      businessName: "Doce da Ana",
      produtos: [{ nome: "Bolo", tipo: "produto", descricao: "bolo caseiro" }],
      camposModulo: [{ campo: "missao", valor: "vender bolo" }],
    });
    expect(systemInstruction).toContain(REGRA_SAIDA);
    expect(semTravessaoForaDaRegra(systemInstruction + prompt)).toBe(true);
  });
});
