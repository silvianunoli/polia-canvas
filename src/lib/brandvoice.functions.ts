import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  brand_feeling: z.string().min(1).max(2000),
  brand_visual_style: z.string().min(1).max(2000),
  brand_voice_yes: z.string().min(1).max(2000),
  variante: z.enum(["recomendada", "poetica", "direta", "outra"]).optional(),
});

export type BrandVoicePalavra = { palavra: string; subtitulo: string };
export type BrandVoiceJson = {
  palavras: BrandVoicePalavra[];
  frase: string;
  variacoes: { recomendada: string; poetica: string; direta: string };
};

export const gerarVozMarca = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ voz: BrandVoiceJson | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { voz: null, error: "API indisponível no momento." };

    const reforco =
      data.variante === "poetica"
        ? "Gere uma versão mais poética e sensorial."
        : data.variante === "direta"
          ? "Gere uma versão mais direta e objetiva."
          : data.variante === "outra"
            ? "Gere uma variação alternativa, diferente da anterior."
            : "";

    const prompt = `Você é uma consultora de branding sênior especializada em pequenas empresas brasileiras.

Com base nas respostas da empreendedora:

SENTIMENTO QUE A MARCA PASSA:
"${data.brand_feeling}"

ESTILO VISUAL:
"${data.brand_visual_style}"

VOZ E TOM:
"${data.brand_voice_yes}"

${reforco}

Gere a voz de marca no formato JSON exato abaixo. Cada palavra deve ter 1 a 2 sílabas e ser substantivo. O subtítulo é como a palavra se manifesta na prática (1 a 3 palavras). A frase deve ter no máximo 12 palavras e ser poética mas clara.

Responda APENAS com o JSON, sem markdown, sem explicações.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          tools: [
            {
              type: "function",
              function: {
                name: "voz_de_marca",
                description: "Retorna a voz de marca estruturada.",
                parameters: {
                  type: "object",
                  properties: {
                    palavras: {
                      type: "array",
                      minItems: 3,
                      maxItems: 3,
                      items: {
                        type: "object",
                        properties: {
                          palavra: { type: "string" },
                          subtitulo: { type: "string" },
                        },
                        required: ["palavra", "subtitulo"],
                        additionalProperties: false,
                      },
                    },
                    frase: { type: "string" },
                    variacoes: {
                      type: "object",
                      properties: {
                        recomendada: { type: "string" },
                        poetica: { type: "string" },
                        direta: { type: "string" },
                      },
                      required: ["recomendada", "poetica", "direta"],
                      additionalProperties: false,
                    },
                  },
                  required: ["palavras", "frase", "variacoes"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "voz_de_marca" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { voz: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { voz: null, error: "Créditos esgotados." };
        return { voz: null, error: "Não consegui montar a voz de marca agora." };
      }

      const json = await res.json();
      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = toolCall?.function?.arguments;
      if (!argsStr) return { voz: null, error: "Resposta vazia da IA." };
      const parsed = JSON.parse(argsStr) as BrandVoiceJson;
      return { voz: parsed, error: null };
    } catch (err) {
      console.error("gerarVozMarca error:", err);
      return { voz: null, error: "Falha de conexão." };
    }
  });
