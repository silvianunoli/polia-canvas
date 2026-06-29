import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

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

const schema: JsonSchema = {
  type: "object",
  properties: {
    descricao_refinada: { type: "string" },
    entrega: { type: "string" },
    preco_destaque: { type: "string" },
    cliente_ideal: { type: "string" },
  },
  required: ["descricao_refinada", "entrega", "preco_destaque", "cliente_ideal"],
};

export const gerarFichaProduto = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ficha: FichaProduto | null; error: string | null }> => {
    const prompt = `Você é consultora de negócios especializada em pequenas empreendedoras brasileiras.

PRODUTO OU SERVIÇO:
"${data.product_description}"

FORMA DE ENTREGA:
"${data.delivery_method}"

PREÇO E PAGAMENTO:
"${data.price_range}"

Gere a ficha de produto. A descrição refinada deve ter 2-3 frases em 1ª pessoa, com clareza e apelo. A entrega deve ser 1 frase clara sobre logística e prazo. O preço em destaque deve ser direto (ex: "A partir de R$ 8/und"). O cliente ideal em até 12 palavras. Sem emojis. Sem traço longo.`;

    const { data: ficha, error } = await gerarJsonIA<FichaProduto>(prompt, schema, {
      maxOutputTokens: 1024,
    });
    return { ficha, error };
  });
