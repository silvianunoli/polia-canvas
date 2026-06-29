import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  growth_vision: z.string().min(1).max(2000),
  key_partners: z.string().min(1).max(2000),
  timeline_goal: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type PlanoCrescimento = {
  visao_refinada: string;
  rede_descrita: string;
  proximo_passo: string;
  afirmacao: string;
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    visao_refinada: { type: "string" },
    rede_descrita: { type: "string" },
    proximo_passo: { type: "string" },
    afirmacao: { type: "string" },
  },
  required: ["visao_refinada", "rede_descrita", "proximo_passo", "afirmacao"],
};

export const gerarPlanoCrescimento = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ plano: PlanoCrescimento | null; error: string | null }> => {
    const prompt = `Você é mentora de crescimento para pequenas empreendedoras brasileiras.

VISÃO DE CRESCIMENTO:
"${data.growth_vision}"

REDE DE APOIO:
"${data.key_partners}"

PRÓXIMO PASSO:
"${data.timeline_goal}"

Gere o plano: visao_refinada são 2-3 frases que traduzem a visão dela de forma clara e motivadora, sem exageros. rede_descrita são 2-3 frases sobre as pessoas e conexões que ela já tem ou precisa cultivar. proximo_passo é o primeiro passo concreto e imediato que ela mesma descreveu, reformulado como compromisso, máximo 2 linhas. afirmacao é frase curta e poderosa em primeira pessoa que resume o que ela está construindo, natural, sem clichê, máximo 20 palavras. Sem traço longo. Sem emojis.`;

    const { data: plano, error } = await gerarJsonIA<PlanoCrescimento>(prompt, schema, {
      maxOutputTokens: 1024,
    });
    return { plano, error };
  });
