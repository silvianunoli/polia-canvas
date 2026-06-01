import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  welcome_protocol: z.string().min(1).max(2000),
  issue_handling: z.string().min(1).max(2000),
  loyalty_strategy: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type ProtocoloCuidado = {
  boas_vindas: string;
  resolucao: string;
  fidelizacao: string;
  mensagem_pos_entrega: string;
};

export const gerarProtocoloCuidado = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ protocolo: ProtocoloCuidado | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { protocolo: null, error: "API indisponível no momento." };

    const prompt = `Você é consultora de atendimento e experiência do cliente, especializada em pequenas empreendedoras brasileiras.

COMO VOCÊ RECEBE NOVAS CLIENTES:
"${data.welcome_protocol}"

COMO RESOLVE PROBLEMAS:
"${data.issue_handling}"

COMO FIDELIZA:
"${data.loyalty_strategy}"

Gere o protocolo de cuidado. boas_vindas deve ter 2-3 frases descrevendo o protocolo de boas-vindas em forma de guia prático. resolucao deve ter 2-3 frases sobre o protocolo de resolução de problemas. fidelizacao deve ter 2-3 frases sobre as ações de fidelização mais eficazes. mensagem_pos_entrega deve ser uma mensagem de WhatsApp de 2-3 linhas pra enviar após a entrega, calorosa, natural, sem emoji, sem traço longo.`;

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
                name: "protocolo_cuidado",
                description: "Retorna o protocolo de cuidado estruturado.",
                parameters: {
                  type: "object",
                  properties: {
                    boas_vindas: { type: "string" },
                    resolucao: { type: "string" },
                    fidelizacao: { type: "string" },
                    mensagem_pos_entrega: { type: "string" },
                  },
                  required: ["boas_vindas", "resolucao", "fidelizacao", "mensagem_pos_entrega"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "protocolo_cuidado" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { protocolo: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { protocolo: null, error: "Créditos esgotados." };
        return { protocolo: null, error: "Não consegui montar seu protocolo agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { protocolo: null, error: "Resposta vazia da IA." };
      return { protocolo: JSON.parse(argsStr) as ProtocoloCuidado, error: null };
    } catch (err) {
      console.error("gerarProtocoloCuidado error:", err);
      return { protocolo: null, error: "Falha de conexão." };
    }
  });
