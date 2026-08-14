import { describe, it, expect, vi, beforeEach } from "vitest";

// O sanitizador de travessão precisa estar no ÚNICO caminho de volta do
// Gemini: todas as superfícies de IA (Aimer, raio-x, plano de conteúdo,
// Planejamento) chamam gerarTexto(), então provar aqui prova pra todas.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { gerarTexto } from "./gemini.server";

beforeEach(() => {
  process.env.GEMINI_API_KEY = "chave-de-teste";
  generateContent.mockReset();
});

describe("gerarTexto", () => {
  it("sanitiza travessão da resposta do modelo antes de devolver", async () => {
    generateContent.mockResolvedValue({
      text: "O resultado subiu — puxado pelo bolo — e a meta ficou entre 10–20%.",
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7 },
    });
    const r = await gerarTexto({ modelo: "m", systemInstruction: "s", prompt: "p" });
    expect(r.texto).toBe("O resultado subiu, puxado pelo bolo, e a meta ficou entre 10-20%.");
    expect(r.tokensIn).toBe(5);
    expect(r.tokensOut).toBe(7);
  });

  it("resposta sem texto vira string vazia (sem quebrar o sanitizador)", async () => {
    generateContent.mockResolvedValue({ text: undefined, usageMetadata: undefined });
    const r = await gerarTexto({ modelo: "m", systemInstruction: "s", prompt: "p" });
    expect(r.texto).toBe("");
  });
});
