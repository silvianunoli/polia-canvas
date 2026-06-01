import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const gerarMapaPosicionamento = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ mapa: PositioningMap | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { mapa: null, error: "API indisponível no momento." };

    const prompt = `Você é uma estrategista de negócios sênior especializada em posicionamento de pequenas empresas brasileiras.

Com base nas respostas da empreendedora${data.business_name ? ` (negócio: ${data.business_name})` : ""}:

CONCORRENTES:
"${data.competitors}"

DIFERENCIAL:
"${data.differentiators}"

POR QUE A ESCOLHERIAM:
"${data.positioning_statement}"

Gere o mapa de posicionamento. A declaração deve ter 2 a 3 frases, ser em primeira pessoa, e soar como algo que ela diria com orgulho. O ângulo único deve ter no máximo 15 palavras e ser inesquecível. Sem emojis. Sem traço longo.`;

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
                name: "mapa_posicionamento",
                description: "Retorna o mapa de posicionamento estruturado.",
                parameters: {
                  type: "object",
                  properties: {
                    declaracao: { type: "string" },
                    diferencial: { type: "string" },
                    naoAlcancam: { type: "string" },
                    anguloUnico: { type: "string" },
                  },
                  required: ["declaracao", "diferencial", "naoAlcancam", "anguloUnico"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "mapa_posicionamento" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { mapa: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { mapa: null, error: "Créditos esgotados." };
        return { mapa: null, error: "Não consegui montar seu mapa agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { mapa: null, error: "Resposta vazia da IA." };
      return { mapa: JSON.parse(argsStr) as PositioningMap, error: null };
    } catch (err) {
      console.error("gerarMapaPosicionamento error:", err);
      return { mapa: null, error: "Falha de conexão." };
    }
  });
