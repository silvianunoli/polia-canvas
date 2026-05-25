import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const gerarSistemaControle = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ sistema: SistemaControle | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { sistema: null, error: "API indisponível no momento." };

    const prompt = `Você é consultora de operações para pequenas empreendedoras brasileiras.

CAPACIDADE DE PRODUÇÃO:
"${data.production_capacity}"

SISTEMA DE CONTROLE ATUAL:
"${data.tracking_system}"

GATILHO DE REPOSIÇÃO:
"${data.restock_triggers}"

Gere o sistema de controle. capacidade_resumida deve ter 1-2 frases sobre a capacidade real e os limites importantes. controle_atual deve ter 1-2 frases descrevendo o sistema atual com naturalidade, sem julgamento. gatilho_reposicao deve ter 1 frase clara sobre quando e como repor para nunca faltar. proximo_passo deve ser 1 ação concreta e simples para melhorar o controle hoje, máximo 15 palavras. Sem traço longo. Sem emojis.`;

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
                name: "sistema_controle",
                description: "Retorna o sistema de controle estruturado.",
                parameters: {
                  type: "object",
                  properties: {
                    capacidade_resumida: { type: "string" },
                    controle_atual: { type: "string" },
                    gatilho_reposicao: { type: "string" },
                    proximo_passo: { type: "string" },
                  },
                  required: ["capacidade_resumida", "controle_atual", "gatilho_reposicao", "proximo_passo"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "sistema_controle" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { sistema: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { sistema: null, error: "Créditos esgotados." };
        return { sistema: null, error: "Não consegui montar seu sistema agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { sistema: null, error: "Resposta vazia da IA." };
      return { sistema: JSON.parse(argsStr) as SistemaControle, error: null };
    } catch (err) {
      console.error("gerarSistemaControle error:", err);
      return { sistema: null, error: "Falha de conexão." };
    }
  });
