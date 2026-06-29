import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarTextoIA } from "./gemini";

const inputSchema = z.object({
  profile_story: z.string().min(1).max(2000),
  problem_solved: z.string().min(1).max(2000),
  target_customer: z.string().min(1).max(2000),
});

export const gerarMiniPitch = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const prompt = `Você é a Pólia, assistente de negócios para mulheres empreendedoras brasileiras.

Com base nas respostas abaixo, crie um mini-pitch de 3 a 4 frases em português brasileiro, direto, acolhedor e sem jargão.

HISTÓRIA: ${data.profile_story}
DOR QUE RESOLVE: ${data.problem_solved}
PRA QUEM: ${data.target_customer}

O mini-pitch deve:
- Começar com quem a pessoa é (não o negócio)
- Descrever a dor do cliente de forma específica
- Mostrar como ela resolve
- Ter tom conversacional, sem hype
- Máximo 4 frases
- ZERO emojis, ZERO traço longo, use vírgula ou hífen simples`;

    const { texto, error } = await gerarTextoIA(prompt, { maxOutputTokens: 600 });
    return { minipitch: texto ?? "", error };
  });
