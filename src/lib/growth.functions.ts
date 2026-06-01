import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const gerarPainelNumeros = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ painel: PainelNumeros | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { painel: null, error: "API indisponível no momento." };

    const prompt = `Você é consultora de crescimento para pequenas empreendedoras brasileiras.

O QUE MAIS IMPORTA MEDIR:
"${data.key_number_1}"

RITMO DE REVISÃO ATUAL:
"${data.review_rhythm}"

GATILHOS DE AÇÃO:
"${data.action_triggers}"

Gere o painel: numero_1 é o número principal que ela deve acompanhar (nome claro e por que importa, 1-2 frases). numero_2 é um segundo número complementar (nome claro e o que ele revela, 1-2 frases). numero_3 é um terceiro número de saúde do negócio (nome claro e quando prestar atenção, 1-2 frases). ritmo_recomendado é a frequência de revisão adaptada ao estilo dela, prática e realista (1 frase). gatilho_principal é uma regra clara de quando agir baseada no que ela descreveu, máximo 2 linhas. Sem traço longo. Sem emojis.`;

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
                name: "painel_numeros",
                description: "Retorna o painel de 3 números estruturado.",
                parameters: {
                  type: "object",
                  properties: {
                    numero_1: { type: "string" },
                    numero_2: { type: "string" },
                    numero_3: { type: "string" },
                    ritmo_recomendado: { type: "string" },
                    gatilho_principal: { type: "string" },
                  },
                  required: ["numero_1", "numero_2", "numero_3", "ritmo_recomendado", "gatilho_principal"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "painel_numeros" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { painel: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { painel: null, error: "Créditos esgotados." };
        return { painel: null, error: "Não consegui montar seu painel agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { painel: null, error: "Resposta vazia da IA." };
      return { painel: JSON.parse(argsStr) as PainelNumeros, error: null };
    } catch (err) {
      console.error("gerarPainelNumeros error:", err);
      return { painel: null, error: "Falha de conexão." };
    }
  });
