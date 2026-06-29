import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gerarJsonIA, type JsonSchema } from "./gemini";

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

const schema: JsonSchema = {
  type: "object",
  properties: {
    passo_descoberta: { type: "string" },
    passo_decisao: { type: "string" },
    passo_fechamento: { type: "string" },
    mensagem_fechamento: { type: "string" },
  },
  required: ["passo_descoberta", "passo_decisao", "passo_fechamento", "mensagem_fechamento"],
};

export const gerarRoteiroFechamento = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(
    async ({ data }): Promise<{ roteiro: RoteiroFechamento | null; error: string | null }> => {
      const prompt = `Você é consultora de vendas especializada em pequenas empreendedoras brasileiras.

COMO ELA TE DESCOBRE:
"${data.awareness_source}"

O QUE A CONVENCE:
"${data.decision_trigger}"

COMO VOCÊ FECHA:
"${data.closing_method}"

Gere o roteiro de fechamento. passo_descoberta deve ter 1-2 frases sobre como otimizar o canal de descoberta. passo_decisao deve ter 1-2 frases sobre como usar o gatilho de decisão a seu favor. passo_fechamento deve ter 1-2 frases sobre como tornar o fechamento mais fluido. mensagem_fechamento deve ser uma mensagem curta de WhatsApp de até 3 linhas, natural e sem pressão, pra usar após enviar o orçamento. Sem traço longo. Sem emojis.`;

      const { data: roteiro, error } = await gerarJsonIA<RoteiroFechamento>(prompt, schema, {
        maxOutputTokens: 1536,
      });
      return { roteiro, error };
    },
  );
