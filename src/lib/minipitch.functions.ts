import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

const inputSchema = z.object({
  profile_story: z.string().min(1).max(2000),
  problem_solved: z.string().min(1).max(2000),
  target_customer: z.string().min(1).max(2000),
});

export type MiniPitch = {
  publico: string;
  solucao: string;
  transformacao: string;
  texto: string;
};

const schema: JsonSchema = {
  type: "object",
  properties: {
    publico: { type: "string" },
    solucao: { type: "string" },
    transformacao: { type: "string" },
    texto: { type: "string" },
  },
  required: ["publico", "solucao", "transformacao", "texto"],
};

export const gerarMiniPitch = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ pitch: MiniPitch | null; error: string | null }> => {
    const prompt = `Você é a Pólia, assistente de negócios para mulheres empreendedoras brasileiras.

Com base nas respostas abaixo, monte um mini-pitch em português brasileiro, direto, acolhedor e sem jargão.

HISTÓRIA: ${data.profile_story}
DOR QUE RESOLVE: ${data.problem_solved}
PRA QUEM: ${data.target_customer}

Gere quatro campos:
- publico: quem ela ajuda, em uma frase curta e específica (comece com "Eu ajudo...").
- solucao: o que ela faz na prática, em uma frase curta começando com um verbo (exemplo: "crio sistemas de organização").
- transformacao: o que muda na vida de quem ela atende, em uma frase curta.
- texto: o mini-pitch completo, de 3 a 4 frases, juntando os três pontos de forma natural e conversacional. Começa com quem ela é, descreve a dor de forma específica e mostra como resolve. Tom conversacional, sem hype, ZERO emojis, ZERO traço longo (use vírgula ou hífen simples).`;

    const { data: pitch, error } = await gerarJsonIA<MiniPitch>(prompt, schema, {
      maxOutputTokens: 1024,
    });
    return { pitch, error };
  });
