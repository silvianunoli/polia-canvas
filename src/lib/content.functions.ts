import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const gerarPlanoConteudo = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ plano: PlanoConteudo | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { plano: null, error: "API indisponível no momento." };

    const prompt = `Você é estrategista de conteúdo para pequenas empreendedoras brasileiras.

O QUE A CLIENTE IDEAL CONSOME:
"${data.audience_content_types}"

O QUE PARA O SCROLL:
"${data.scroll_stoppers}"

RITMO DE PUBLICAÇÃO ATUAL:
"${data.publishing_rhythm}"

Gere o plano de conteúdo. tipos_conteudo deve ter 2-3 frases sobre os tipos de conteúdo que mais ressoam com a audiência dela. gatilhos_parada deve ter 2-3 frases sobre o que funciona pra parar o scroll baseado no que ela descreveu. ritmo_sugerido deve ser uma frequência realista baseada no que ela descreveu (exemplo: "3x por semana: 2 posts no feed e 1 Reels"). ideias deve ser um array com exatamente 3 ideias de conteúdo concretas, cada uma com formato e tema, diferentes entre si. Sem traço longo. Sem emojis.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          tools: [
            {
              type: "function",
              function: {
                name: "plano_conteudo",
                description: "Retorna o plano de conteúdo estruturado.",
                parameters: {
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
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "plano_conteudo" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429)
          return { plano: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { plano: null, error: "Créditos esgotados." };
        return { plano: null, error: "Não consegui montar seu plano agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { plano: null, error: "Resposta vazia da IA." };
      return { plano: JSON.parse(argsStr) as PlanoConteudo, error: null };
    } catch (err) {
      console.error("gerarPlanoConteudo error:", err);
      return { plano: null, error: "Falha de conexão." };
    }
  });
