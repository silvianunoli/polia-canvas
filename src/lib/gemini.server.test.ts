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

// gerarTexto() registra latência/falha de IA no Founder Dashboard via
// founder-eventos.server, que instancia o Supabase admin (exige env). Aqui o
// assunto é o sanitizador, então a telemetria vira espião: provamos só que ela
// é chamada, sem tocar em banco.
const { registrarEventoSistema } = vi.hoisted(() => ({ registrarEventoSistema: vi.fn() }));
vi.mock("@/lib/founder-eventos.server", () => ({ registrarEventoSistema }));

import { gerarTexto } from "./gemini.server";

beforeEach(() => {
  process.env.GEMINI_API_KEY = "chave-de-teste";
  generateContent.mockReset();
  registrarEventoSistema.mockReset();
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

describe("gerarTexto: telemetria do Founder Dashboard", () => {
  it("registra ia_call com tokens e latência quando o modelo responde", async () => {
    generateContent.mockResolvedValue({
      text: "ok",
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
    });
    await gerarTexto({ modelo: "m", systemInstruction: "s", prompt: "p" });
    expect(registrarEventoSistema).toHaveBeenCalledTimes(1);
    const evento = registrarEventoSistema.mock.calls[0][0];
    expect(evento.tipo).toBe("ia_call");
    expect(evento.origem).toBe("gemini");
    expect(evento.servico).toBe("m");
    expect(evento.detalhes).toEqual({ tokens_in: 3, tokens_out: 4 });
    expect(typeof evento.latenciaMs).toBe("number");
  });

  it("registra ia_failure e repassa o erro quando o modelo falha de vez", async () => {
    // Erro que não é transitório: sem retry, falha final.
    generateContent.mockRejectedValue(new Error("SAFETY: conteúdo bloqueado"));
    await expect(gerarTexto({ modelo: "m", systemInstruction: "s", prompt: "p" })).rejects.toThrow(
      "SAFETY",
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(registrarEventoSistema).toHaveBeenCalledTimes(1);
    expect(registrarEventoSistema.mock.calls[0][0].tipo).toBe("ia_failure");
  });

  it("tenta de novo uma vez em falha transitória (5xx/timeout) antes de desistir", async () => {
    generateContent
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce({ text: "depois do retry", usageMetadata: undefined });
    const r = await gerarTexto({ modelo: "m", systemInstruction: "s", prompt: "p" });
    expect(r.texto).toBe("depois do retry");
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(registrarEventoSistema.mock.calls[0][0].tipo).toBe("ia_call");
  });
});
