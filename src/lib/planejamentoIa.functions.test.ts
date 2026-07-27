import { describe, it, expect } from "vitest";
import {
  configDoPlano,
  periodoAtual,
  contextoInsuficiente,
  respostaValida,
  montarPrompt,
} from "./planejamentoIa.functions";

describe("configDoPlano", () => {
  it("confere usa o modelo barato e 1 geração por mês", () => {
    expect(configDoPlano("confere")).toEqual({ modelo: "gemini-flash-latest", limite: 1 });
  });

  it("controle e projete usam o modelo melhor, com tetos diferentes", () => {
    expect(configDoPlano("controle")).toEqual({ modelo: "gemini-pro-latest", limite: 30 });
    expect(configDoPlano("projete")).toEqual({ modelo: "gemini-pro-latest", limite: 60 });
  });

  it("beta recebe um teto real (nunca bypassa a cota, mesmo generoso)", () => {
    const cfg = configDoPlano("beta");
    expect(cfg.limite).toBeGreaterThan(0);
    expect(Number.isFinite(cfg.limite)).toBe(true);
  });

  it("plano desconhecido/nulo cai no mesmo teto seguro do Confere", () => {
    expect(configDoPlano(null)).toEqual(configDoPlano("confere"));
    expect(configDoPlano("cancelada")).toEqual(configDoPlano("confere"));
  });
});

describe("periodoAtual", () => {
  it("formata ano-mês em UTC com dois dígitos", () => {
    expect(periodoAtual(new Date(Date.UTC(2026, 6, 27)))).toBe("2026-07");
    expect(periodoAtual(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01");
  });

  it("mês de calendário vira exatamente na troca de mês (UTC)", () => {
    expect(periodoAtual(new Date(Date.UTC(2026, 6, 31, 23, 59)))).toBe("2026-07");
    expect(periodoAtual(new Date(Date.UTC(2026, 7, 1, 0, 0)))).toBe("2026-08");
  });
});

describe("contextoInsuficiente", () => {
  it("é insuficiente só quando NÃO tem tipo de negócio E NÃO tem produto", () => {
    expect(contextoInsuficiente(null, 0)).toBe(true);
    expect(contextoInsuficiente("", 0)).toBe(true);
  });

  it("qualquer um dos dois já é suficiente", () => {
    expect(contextoInsuficiente("servico", 0)).toBe(false);
    expect(contextoInsuficiente(null, 1)).toBe(false);
    expect(contextoInsuficiente("produto_fisico", 3)).toBe(false);
  });
});

describe("respostaValida", () => {
  it("rejeita vazio, só espaço, ou texto curto demais", () => {
    expect(respostaValida("")).toBe(false);
    expect(respostaValida("   ")).toBe(false);
    expect(respostaValida("oi")).toBe(false);
  });

  it("aceita um rascunho de tamanho razoável", () => {
    expect(respostaValida("Um rascunho de verdade, com conteúdo suficiente.")).toBe(true);
  });
});

describe("montarPrompt", () => {
  it("inclui a pergunta real e o contexto disponível, sem quebrar quando falta algo", () => {
    const { systemInstruction, prompt } = montarPrompt("Por que você criou esse negócio?", {
      businessType: "servico",
      businessName: "Ateliê da Ana",
      produtos: [{ nome: "Aula avulsa", tipo: "servico", descricao: null }],
      camposModulo: [
        { campo: "marca.missao", valor: "Ajudar quem quer aprender aquarela." },
        { campo: "marca.valores", valor: null }, // ainda não respondida, não deve poluir o prompt
      ],
    });
    expect(systemInstruction).toContain("3ª pessoa");
    expect(prompt).toContain("Por que você criou esse negócio?");
    expect(prompt).toContain("Ateliê da Ana");
    expect(prompt).toContain("Aula avulsa");
    expect(prompt).toContain("Ajudar quem quer aprender aquarela.");
    expect(prompt).not.toContain("marca.valores");
  });

  it("não quebra com contexto mínimo (sem nome, sem produto, sem respostas anteriores)", () => {
    const { prompt } = montarPrompt("Pergunta qualquer", {
      businessType: null,
      businessName: null,
      produtos: [],
      camposModulo: [],
    });
    expect(prompt).toContain("Pergunta qualquer");
  });
});
