import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  key_number_1: z.string().min(1).max(2000),
  review_rhythm: z.string().min(1).max(2000),
  action_triggers: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type PainelNumeros = {
  numero_1: string;
  numero_2: string;
  numero_3: string;
  ritmo_recomendado: string;
  gatilho_principal: string;
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    numero_1: { type: "string" },
    numero_2: { type: "string" },
    numero_3: { type: "string" },
    ritmo_recomendado: { type: "string" },
    gatilho_principal: { type: "string" },
  },
  required: ["numero_1", "numero_2", "numero_3", "ritmo_recomendado", "gatilho_principal"],
};

export const gerarPainelNumeros = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ painel: PainelNumeros | null; error: string | null }> => {
    const prompt = `Você é consultora de crescimento para pequenas empreendedoras brasileiras.

O QUE MAIS IMPORTA MEDIR:
"${data.key_number_1}"

RITMO DE REVISÃO ATUAL:
"${data.review_rhythm}"

GATILHOS DE AÇÃO:
"${data.action_triggers}"

Gere o painel: numero_1 é o número principal que ela deve acompanhar (nome claro e por que importa, 1-2 frases). numero_2 é um segundo número complementar (nome claro e o que ele revela, 1-2 frases). numero_3 é um terceiro número de saúde do negócio (nome claro e quando prestar atenção, 1-2 frases). ritmo_recomendado é a frequência de revisão adaptada ao estilo dela, prática e realista (1 frase). gatilho_principal é uma regra clara de quando agir baseada no que ela descreveu, máximo 2 linhas. Sem traço longo. Sem emojis.`;

    const { data: painel, error } = await gerarJsonIA<PainelNumeros>(prompt, schema, {
      maxOutputTokens: 2048,
    });
    return { painel, error };
  });
