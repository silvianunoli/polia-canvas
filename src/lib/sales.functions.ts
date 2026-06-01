import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  awareness_source: z.string().min(1).max(2000),
  decision_trigger: z.string().min(1).max(2000),
  closing_method: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type RoteiroFechamento = {
  passo_descoberta: string;
  passo_decisao: string;
  passo_fechamento: string;
  mensagem_fechamento: string;
};

export const gerarRoteiroFechamento = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ roteiro: RoteiroFechamento | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { roteiro: null, error: "API indisponível no momento." };

    const prompt = `Você é consultora de vendas especializada em pequenas empreendedoras brasileiras.

COMO ELA TE DESCOBRE:
"${data.awareness_source}"

O QUE A CONVENCE:
"${data.decision_trigger}"

COMO VOCÊ FECHA:
"${data.closing_method}"

Gere o roteiro de fechamento. passo_descoberta deve ter 1-2 frases sobre como otimizar o canal de descoberta. passo_decisao deve ter 1-2 frases sobre como usar o gatilho de decisão a seu favor. passo_fechamento deve ter 1-2 frases sobre como tornar o fechamento mais fluido. mensagem_fechamento deve ser uma mensagem curta de WhatsApp de até 3 linhas, natural e sem pressão, pra usar após enviar o orçamento. Sem traço longo. Sem emojis.`;

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
                name: "roteiro_fechamento",
                description: "Retorna o roteiro de fechamento estruturado.",
                parameters: {
                  type: "object",
                  properties: {
                    passo_descoberta: { type: "string" },
                    passo_decisao: { type: "string" },
                    passo_fechamento: { type: "string" },
                    mensagem_fechamento: { type: "string" },
                  },
                  required: ["passo_descoberta", "passo_decisao", "passo_fechamento", "mensagem_fechamento"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "roteiro_fechamento" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { roteiro: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { roteiro: null, error: "Créditos esgotados." };
        return { roteiro: null, error: "Não consegui montar seu roteiro agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { roteiro: null, error: "Resposta vazia da IA." };
      return { roteiro: JSON.parse(argsStr) as RoteiroFechamento, error: null };
    } catch (err) {
      console.error("gerarRoteiroFechamento error:", err);
      return { roteiro: null, error: "Falha de conexão." };
    }
  });
