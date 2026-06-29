import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

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

const schema: JsonSchema = {
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
    },
  },
  required: ["palavras", "frase", "variacoes"],
};

export const gerarVozMarca = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ voz: BrandVoiceJson | null; error: string | null }> => {
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

Gere a voz de marca. Cada palavra deve ter 1 a 2 sílabas e ser substantivo. O subtítulo é como a palavra se manifesta na prática (1 a 3 palavras). A frase deve ter no máximo 12 palavras e ser poética mas clara.`;

    const { data: voz, error } = await gerarJsonIA<BrandVoiceJson>(prompt, schema, {
      maxOutputTokens: 1024,
    });
    return { voz, error };
  });
