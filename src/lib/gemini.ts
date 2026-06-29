// Cliente Gemini nativo (Google AI Studio) — roda só no servidor (server functions).
// O gateway antigo (Lovable) saiu do ar em ~jun/2026; falamos direto com a API do Gemini.
// Requer GEMINI_API_KEY no ambiente: .env em dev, secret do Worker em prod.
// A chave NUNCA tem prefixo VITE_, então nunca vaza pro client.

const MODELO = "gemini-2.5-flash";

const endpoint = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${key}`;

// Subset do JSON Schema que o responseSchema do Gemini aceita.
export type JsonSchema = {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: string[];
  minItems?: number;
  maxItems?: number;
  nullable?: boolean;
};

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
};

function lerTexto(json: GeminiResponse): string {
  return (
    json?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function erroAmigavel(status: number, corpo: string): string {
  if (status === 429) return "Muitas tentativas em pouco tempo. Tenta de novo em instantes?";
  if (status === 400 && corpo.includes("API_KEY")) return "A chave da IA não está válida.";
  if (status === 403) return "A chave da IA não tem permissão pra esse modelo.";
  return "A IA não respondeu agora. Tenta de novo daqui a pouco?";
}

function motivoVazio(json: GeminiResponse): string {
  const motivo = json?.candidates?.[0]?.finishReason ?? json?.promptFeedback?.blockReason;
  if (motivo === "SAFETY" || motivo === "PROHIBITED_CONTENT")
    return "Prefiro não responder isso. Posso te ajudar com algo do seu negócio?";
  if (motivo === "MAX_TOKENS") return "A resposta ficou longa demais. Tenta de novo?";
  return "A resposta veio vazia. Tenta reformular?";
}

type GenOpts = { temperature?: number; maxOutputTokens?: number };

/** Geração de texto livre. */
export async function gerarTextoIA(
  prompt: string,
  opts: GenOpts = {},
): Promise<{ texto: string | null; error: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { texto: null, error: "A IA ainda não está conectada. (falta a chave)" };

  try {
    const res = await fetch(endpoint(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxOutputTokens ?? 1024,
          topP: 0.95,
        },
      }),
    });

    if (!res.ok) {
      const corpo = await res.text();
      console.error("Gemini texto error:", res.status, corpo);
      return { texto: null, error: erroAmigavel(res.status, corpo) };
    }

    const json = (await res.json()) as GeminiResponse;
    const texto = lerTexto(json);
    if (!texto) return { texto: null, error: motivoVazio(json) };
    return { texto, error: null };
  } catch (err) {
    console.error("gerarTextoIA error:", err);
    return { texto: null, error: "Falha de conexão com a IA." };
  }
}

/** Geração de JSON estruturado, validado pelo responseSchema do Gemini. */
export async function gerarJsonIA<T>(
  prompt: string,
  schema: JsonSchema,
  opts: GenOpts = {},
): Promise<{ data: T | null; error: string | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { data: null, error: "A IA ainda não está conectada. (falta a chave)" };

  try {
    const res = await fetch(endpoint(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxOutputTokens ?? 2048,
          topP: 0.95,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });

    if (!res.ok) {
      const corpo = await res.text();
      console.error("Gemini json error:", res.status, corpo);
      return { data: null, error: erroAmigavel(res.status, corpo) };
    }

    const json = (await res.json()) as GeminiResponse;
    const texto = lerTexto(json);
    if (!texto) return { data: null, error: motivoVazio(json) };

    try {
      return { data: JSON.parse(texto) as T, error: null };
    } catch {
      console.error("Gemini json parse falhou:", texto);
      return { data: null, error: "A IA devolveu um formato inesperado. Tenta de novo?" };
    }
  } catch (err) {
    console.error("gerarJsonIA error:", err);
    return { data: null, error: "Falha de conexão com a IA." };
  }
}
