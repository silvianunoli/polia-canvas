import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  product_description: z.string().min(1).max(2000),
  delivery_method: z.string().min(1).max(2000),
  price_range: z.string().min(1).max(2000),
  business_name: z.string().max(200).optional(),
});

export type FichaProduto = {
  descricao_refinada: string;
  entrega: string;
  preco_destaque: string;
  cliente_ideal: string;
};

export const gerarFichaProduto = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ficha: FichaProduto | null; error: string | null }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ficha: null, error: "API indisponível no momento." };

    const prompt = `Você é consultora de negócios especializada em pequenas empreendedoras brasileiras.

PRODUTO OU SERVIÇO:
"${data.product_description}"

FORMA DE ENTREGA:
"${data.delivery_method}"

PREÇO E PAGAMENTO:
"${data.price_range}"

Gere a ficha de produto. A descrição refinada deve ter 2-3 frases em 1ª pessoa, com clareza e apelo. A entrega deve ser 1 frase clara sobre logística e prazo. O preço em destaque deve ser direto (ex: "A partir de R$ 8/und"). O cliente ideal em até 12 palavras. Sem emojis. Sem traço longo.`;

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
                name: "ficha_produto",
                description: "Retorna a ficha de produto estruturada.",
                parameters: {
                  type: "object",
                  properties: {
                    descricao_refinada: { type: "string" },
                    entrega: { type: "string" },
                    preco_destaque: { type: "string" },
                    cliente_ideal: { type: "string" },
                  },
                  required: ["descricao_refinada", "entrega", "preco_destaque", "cliente_ideal"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "ficha_produto" } },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error:", res.status, text);
        if (res.status === 429) return { ficha: null, error: "Muitas tentativas. Tente novamente em instantes." };
        if (res.status === 402) return { ficha: null, error: "Créditos esgotados." };
        return { ficha: null, error: "Não consegui montar sua ficha agora." };
      }

      const json = await res.json();
      const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) return { ficha: null, error: "Resposta vazia da IA." };
      return { ficha: JSON.parse(argsStr) as FichaProduto, error: null };
    } catch (err) {
      console.error("gerarFichaProduto error:", err);
      return { ficha: null, error: "Falha de conexão." };
    }
  });
