import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  profile_story: z.string().min(1).max(2000),
  problem_solved: z.string().min(1).max(2000),
  target_customer: z.string().min(1).max(2000),
});

export const gerarMiniPitch = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { minipitch: "", error: "API indisponível no momento." };
    }

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

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { minipitch: "", error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { minipitch: "", error: "Créditos esgotados." };
        return { minipitch: "", error: "Não consegui montar o mini-pitch agora." };
      }

      const json = await res.json();
      const minipitch: string = json.choices?.[0]?.message?.content?.trim() ?? "";
      return { minipitch, error: null };
    } catch (err) {
      console.error("gerarMiniPitch error:", err);
      return { minipitch: "", error: "Falha de conexão." };
    }
  });
