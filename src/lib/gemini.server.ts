import { GoogleGenAI } from "@google/genai";

// Client Gemini lazy, mesmo padrão de stripeClient() (src/lib/stripe.functions.ts):
// só instancia na primeira chamada, erro claro se faltar o secret, nunca no client.
let _client: GoogleGenAI | undefined;

function geminiClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini] Missing GEMINI_API_KEY environment variable.");
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

const TIMEOUT_MS = 20_000;

export interface GerarTextoInput {
  modelo: string;
  systemInstruction: string;
  prompt: string;
  // Força saída JSON estruturada (schema no formato aceito pelo SDK). Quem
  // chama ainda precisa validar o JSON recebido (nunca confiar cegamente
  // numa saída de IA, mesmo "forçada").
  responseSchema?: unknown;
}

export interface GerarTextoResultado {
  texto: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

function ehFalhaTransitoria(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  // Falha de rede/servidor (5xx) — nunca retry em rejeição de conteúdo/safety
  // (essas vêm como resposta bem-sucedida sem texto, não como exceção).
  return /50[0-9]|timeout|network|fetch failed|ECONNRESET/i.test(msg);
}

async function chamarUmaVez({
  modelo,
  systemInstruction,
  prompt,
  responseSchema,
}: GerarTextoInput): Promise<GerarTextoResultado> {
  const resposta = await geminiClient().models.generateContent({
    model: modelo,
    contents: prompt,
    config: {
      systemInstruction,
      httpOptions: { timeout: TIMEOUT_MS },
      ...(responseSchema ? { responseMimeType: "application/json", responseSchema } : {}),
    },
  });
  return {
    texto: resposta.text ?? "",
    tokensIn: resposta.usageMetadata?.promptTokenCount ?? null,
    tokensOut: resposta.usageMetadata?.candidatesTokenCount ?? null,
  };
}

// 1 retry automático, só em falha transitória (rede/5xx/timeout) — nunca em
// rejeição de conteúdo. Quem chama decide o que fazer com uma falha final.
export async function gerarTexto(input: GerarTextoInput): Promise<GerarTextoResultado> {
  try {
    return await chamarUmaVez(input);
  } catch (erro) {
    if (!ehFalhaTransitoria(erro)) throw erro;
    return await chamarUmaVez(input);
  }
}
