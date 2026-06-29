import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  competitors: z.string().min(1).max(2000),
  differentiators: z.string().min(1).max(2000),
  positioning_statement: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type PositioningMap = {
  declaracao: string;
  diferencial: string;
  naoAlcancam: string;
  anguloUnico: string;
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    declaracao: { type: "string" },
    diferencial: { type: "string" },
    naoAlcancam: { type: "string" },
    anguloUnico: { type: "string" },
  },
  required: ["declaracao", "diferencial", "naoAlcancam", "anguloUnico"],
};

export const gerarMapaPosicionamento = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ mapa: PositioningMap | null; error: string | null }> => {
    const prompt = `Você é uma estrategista de negócios sênior especializada em posicionamento de pequenas empresas brasileiras.

Com base nas respostas da empreendedora${data.business_name ? ` (negócio: ${data.business_name})` : ""}:

CONCORRENTES:
"${data.competitors}"

DIFERENCIAL:
"${data.differentiators}"

POR QUE A ESCOLHERIAM:
"${data.positioning_statement}"

Gere o mapa de posicionamento. A declaração deve ter 2 a 3 frases, ser em primeira pessoa, e soar como algo que ela diria com orgulho. O ângulo único deve ter no máximo 15 palavras e ser inesquecível. Sem emojis. Sem traço longo.`;

    const { data: mapa, error } = await gerarJsonIA<PositioningMap>(prompt, schema, {
      maxOutputTokens: 1024,
    });
    return { mapa, error };
  });
