import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  main_channel: z.string().min(1).max(2000),
  visual_presence: z.string().min(1).max(2000),
  purchase_path: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type GuiaPresenca = {
  canal_principal: string;
  aparencia_guia: string;
  caminho_resumido: string;
  bio_sugerida: string;
};

export const gerarGuiaPresenca = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ guia: GuiaPresenca | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { guia: null, error: "API indisponível no momento." };

    const prompt = `Você é consultora de marketing digital especializada em pequenas empreendedoras brasileiras.

CANAL PRINCIPAL:
"${data.main_channel}"

APARÊNCIA ONLINE:
"${data.visual_presence}"

CAMINHO DE COMPRA:
"${data.purchase_path}"

Gere o guia de primeira impressão. O canal_principal deve ter 1 frase identificando o canal mais forte e por quê. A aparencia_guia deve ter 2-3 frases descrevendo como ela aparece e o que funciona. O caminho_resumido deve ser um passo a passo simplificado do processo de compra, máximo 3 passos numerados. A bio_sugerida deve ter até 150 caracteres pra redes sociais, sem emoji, com posicionamento claro. Sem traço longo. Sem emojis.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
          tools: [
            {
              type: "function",
              function: {
                name: "guia_presenca",
                description: "Retorna o guia de primeira impressão estruturado.",
                parameters: {
                  type: "object",
                  properties: {
                    canal_principal: { type: "string" },
                    aparencia_guia: { type: "string" },
                    caminho_resumido: { type: "string" },
                    bio_sugerida: { type: "string" },
                  },
                  required: ["canal_principal", "aparencia_guia", "caminho_resumido", "bio_sugerida"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "guia_presenca" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { guia: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { guia: null, error: "Créditos esgotados." };
        return { guia: null, error: "Não consegui montar seu guia agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { guia: null, error: "Resposta vazia da IA." };
      return { guia: JSON.parse(argsStr) as GuiaPresenca, error: null };
    } catch (err) {
      console.error("gerarGuiaPresenca error:", err);
      return { guia: null, error: "Falha de conexão." };
    }
  });
