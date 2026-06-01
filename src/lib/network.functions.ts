import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const gerarPlanoCrescimento = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ plano: PlanoCrescimento | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { plano: null, error: "API indisponível no momento." };

    const prompt = `Você é mentora de crescimento para pequenas empreendedoras brasileiras.

VISÃO DE CRESCIMENTO:
"${data.growth_vision}"

REDE DE APOIO:
"${data.key_partners}"

PRÓXIMO PASSO:
"${data.timeline_goal}"

Gere o plano: visao_refinada são 2-3 frases que traduzem a visão dela de forma clara e motivadora, sem exageros. rede_descrita são 2-3 frases sobre as pessoas e conexões que ela já tem ou precisa cultivar. proximo_passo é o primeiro passo concreto e imediato que ela mesma descreveu, reformulado como compromisso, máximo 2 linhas. afirmacao é frase curta e poderosa em primeira pessoa que resume o que ela está construindo, natural, sem clichê, máximo 20 palavras. Sem traço longo. Sem emojis.`;

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
                name: "plano_crescimento",
                description: "Retorna o plano de crescimento estruturado.",
                parameters: {
                  type: "object",
                  properties: {
                    visao_refinada: { type: "string" },
                    rede_descrita: { type: "string" },
                    proximo_passo: { type: "string" },
                    afirmacao: { type: "string" },
                  },
                  required: ["visao_refinada", "rede_descrita", "proximo_passo", "afirmacao"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "plano_crescimento" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { plano: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { plano: null, error: "Créditos esgotados." };
        return { plano: null, error: "Não consegui montar seu plano agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { plano: null, error: "Resposta vazia da IA." };
      return { plano: JSON.parse(argsStr) as PlanoCrescimento, error: null };
    } catch (err) {
      console.error("gerarPlanoCrescimento error:", err);
      return { plano: null, error: "Falha de conexão." };
    }
  });
