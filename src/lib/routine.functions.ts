import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  production_capacity: z.string().min(1).max(2000),
  tracking_system: z.string().min(1).max(2000),
  restock_triggers: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type SistemaControle = {
  capacidade_resumida: string;
  controle_atual: string;
  gatilho_reposicao: string;
  proximo_passo: string;
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    capacidade_resumida: { type: "string" },
    controle_atual: { type: "string" },
    gatilho_reposicao: { type: "string" },
    proximo_passo: { type: "string" },
  },
  required: ["capacidade_resumida", "controle_atual", "gatilho_reposicao", "proximo_passo"],
};

export const gerarSistemaControle = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ sistema: SistemaControle | null; error: string | null }> => {
    const prompt = `Você é consultora de operações para pequenas empreendedoras brasileiras.

CAPACIDADE DE PRODUÇÃO:
"${data.production_capacity}"

SISTEMA DE CONTROLE ATUAL:
"${data.tracking_system}"

GATILHO DE REPOSIÇÃO:
"${data.restock_triggers}"

Gere o sistema de controle. capacidade_resumida deve ter 1-2 frases sobre a capacidade real e os limites importantes. controle_atual deve ter 1-2 frases descrevendo o sistema atual com naturalidade, sem julgamento. gatilho_reposicao deve ter 1 frase clara sobre quando e como repor para nunca faltar. proximo_passo deve ser 1 ação concreta e simples para melhorar o controle hoje, máximo 15 palavras. Sem traço longo. Sem emojis.`;

    const { data: sistema, error } = await gerarJsonIA<SistemaControle>(prompt, schema, {
      maxOutputTokens: 1536,
    });
    return { sistema, error };
  });
