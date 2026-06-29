import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  audience_content_types: z.string().min(1).max(2000),
  scroll_stoppers: z.string().min(1).max(2000),
  publishing_rhythm: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type PlanoConteudo = {
  tipos_conteudo: string;
  gatilhos_parada: string;
  ritmo_sugerido: string;
  ideias: string[];
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    tipos_conteudo: { type: "string" },
    gatilhos_parada: { type: "string" },
    ritmo_sugerido: { type: "string" },
    ideias: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
  },
  required: ["tipos_conteudo", "gatilhos_parada", "ritmo_sugerido", "ideias"],
};

export const gerarPlanoConteudo = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ plano: PlanoConteudo | null; error: string | null }> => {
    const prompt = `Você é estrategista de conteúdo para pequenas empreendedoras brasileiras.

O QUE A CLIENTE IDEAL CONSOME:
"${data.audience_content_types}"

O QUE PARA O SCROLL:
"${data.scroll_stoppers}"

RITMO DE PUBLICAÇÃO ATUAL:
"${data.publishing_rhythm}"

Gere o plano de conteúdo. tipos_conteudo deve ter 2-3 frases sobre os tipos de conteúdo que mais ressoam com a audiência dela. gatilhos_parada deve ter 2-3 frases sobre o que funciona pra parar o scroll baseado no que ela descreveu. ritmo_sugerido deve ser uma frequência realista baseada no que ela descreveu (exemplo: "3x por semana: 2 posts no feed e 1 Reels"). ideias deve ser um array com exatamente 3 ideias de conteúdo concretas, cada uma com formato e tema, diferentes entre si. Sem traço longo. Sem emojis.`;

    const { data: plano, error } = await gerarJsonIA<PlanoConteudo>(prompt, schema, {
      maxOutputTokens: 2048,
    });
    return { plano, error };
  });
